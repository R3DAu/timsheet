const { XeroClient } = require('xero-node');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Xero Authentication Service
 * Handles OAuth2 authentication, token encryption, and token refresh
 */
class XeroAuthService {
  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID;
    this.clientSecret = process.env.XERO_CLIENT_SECRET;
    this.redirectUri = process.env.XERO_REDIRECT_URI;
    this.encryptionKey = process.env.XERO_ENCRYPTION_KEY;

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('[XeroAuth] Missing Xero OAuth credentials in environment variables');
    }

    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      console.warn('[XeroAuth] XERO_ENCRYPTION_KEY must be at least 32 characters');
    }

    this.xero = null;
    this.initXeroClient();
  }

  /**
   * Initialize XeroClient instance
   */
  initXeroClient() {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      return;
    }

    try {
      this.xero = new XeroClient({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUris: [this.redirectUri],
        scopes: [
          'openid',
          'profile',
          'email',
          'offline_access',
          'accounting.transactions',
          'accounting.contacts',
          'payroll.employees',
          'payroll.payruns',
          'payroll.timesheets',
          'payroll.settings'
        ]
      });
    } catch (error) {
      console.error('[XeroAuth] Failed to initialize XeroClient:', error.message);
    }
  }

  /**
   * Get authorization URL for OAuth flow
   */
  async getAuthorizationUrl() {
    if (!this.xero) {
      throw new Error('Xero client not initialized');
    }

    const consentUrl = await this.xero.buildConsentUrl();
    return consentUrl;
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleCallback(callbackUrl) {
    if (!this.xero) {
      throw new Error('Xero client not initialized');
    }

    try {
      // Exchange auth code for tokens
      const tokenSet = await this.xero.apiCallback(callbackUrl);

      // Get tenant connections
      const tenants = await this.xero.updateTenants();

      if (!tenants || tenants.length === 0) {
        throw new Error('No Xero organizations found');
      }

      // Store tokens for each tenant
      const storedTenants = [];
      for (const tenant of tenants) {
        const encryptedAccess = this.encrypt(tokenSet.access_token);
        const encryptedRefresh = this.encrypt(tokenSet.refresh_token);

        const xeroToken = await prisma.xeroToken.upsert({
          where: { tenantId: tenant.tenantId },
          update: {
            tenantName: tenant.tenantName,
            accessToken: encryptedAccess,
            refreshToken: encryptedRefresh,
            expiresAt: new Date(Date.now() + tokenSet.expires_in * 1000),
            scope: tokenSet.scope,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            tenantId: tenant.tenantId,
            tenantName: tenant.tenantName,
            accessToken: encryptedAccess,
            refreshToken: encryptedRefresh,
            expiresAt: new Date(Date.now() + tokenSet.expires_in * 1000),
            scope: tokenSet.scope,
            isActive: true
          }
        });

        storedTenants.push(xeroToken);
      }

      return storedTenants;
    } catch (error) {
      console.error('[XeroAuth] OAuth callback error:', error);
      throw error;
    }
  }

  /**
   * Get valid access token for a tenant (auto-refresh if expired)
   */
  async getAccessToken(tenantId) {
    const xeroToken = await prisma.xeroToken.findUnique({
      where: { tenantId, isActive: true }
    });

    if (!xeroToken) {
      throw new Error(`No active Xero token found for tenant: ${tenantId}`);
    }

    // Check if token is expired or will expire in next 5 minutes
    const expiresAt = new Date(xeroToken.expiresAt);
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() - now.getTime() < bufferTime) {
      console.log(`[XeroAuth] Token expired for tenant ${tenantId}, refreshing...`);
      return await this.refreshToken(tenantId);
    }

    return this.decrypt(xeroToken.accessToken);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(tenantId) {
    const xeroToken = await prisma.xeroToken.findUnique({
      where: { tenantId }
    });

    if (!xeroToken) {
      throw new Error(`No Xero token found for tenant: ${tenantId}`);
    }

    if (!this.xero) {
      throw new Error('Xero client not initialized');
    }

    try {
      const refreshToken = this.decrypt(xeroToken.refreshToken);

      // Use the SDK's refresh method with client credentials
      const newTokenSet = await this.xero.refreshWithRefreshToken(
        this.clientId,
        this.clientSecret,
        refreshToken
      );

      // Encrypt and store new tokens
      const encryptedAccess = this.encrypt(newTokenSet.access_token);
      const encryptedRefresh = this.encrypt(newTokenSet.refresh_token);

      await prisma.xeroToken.update({
        where: { tenantId },
        data: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          expiresAt: new Date(Date.now() + newTokenSet.expires_in * 1000),
          updatedAt: new Date()
        }
      });

      console.log(`[XeroAuth] Token refreshed successfully for tenant ${tenantId}`);
      return newTokenSet.access_token;
    } catch (error) {
      console.error(`[XeroAuth] Failed to refresh token for tenant ${tenantId}:`, error);

      // Mark token as inactive if refresh fails
      await prisma.xeroToken.update({
        where: { tenantId },
        data: { isActive: false }
      });

      throw new Error('Token refresh failed. Please reconnect your Xero account.');
    }
  }

  /**
   * Get all active Xero tenants
   */
  async getActiveTenants() {
    return await prisma.xeroToken.findMany({
      where: { isActive: true },
      select: {
        id: true,
        tenantId: true,
        tenantName: true,
        isActive: true,
        lastSyncedAt: true,
        createdAt: true,
        companies: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  }

  /**
   * Get all Xero tenants (including inactive)
   */
  async getAllTenants() {
    return await prisma.xeroToken.findMany({
      select: {
        id: true,
        tenantId: true,
        tenantName: true,
        isActive: true,
        expiresAt: true,
        lastSyncedAt: true,
        createdAt: true,
        companies: {
          include: {
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Disconnect a Xero tenant
   */
  async disconnectTenant(tenantId) {
    await prisma.xeroToken.update({
      where: { tenantId },
      data: { isActive: false }
    });

    console.log(`[XeroAuth] Disconnected tenant: ${tenantId}`);
  }

  /**
   * Reactivate a Xero tenant (marks as active so reconnect will work)
   */
  async reactivateTenant(tenantId) {
    await prisma.xeroToken.update({
      where: { tenantId },
      data: { isActive: true }
    });

    console.log(`[XeroAuth] Reactivated tenant: ${tenantId}`);
  }

  /**
   * Encrypt a string using AES-256-CBC
   */
  encrypt(text) {
    if (!this.encryptionKey) {
      throw new Error('XERO_ENCRYPTION_KEY not configured');
    }

    const key = Buffer.from(this.encryptionKey.substring(0, 32), 'utf-8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt a string using AES-256-CBC
   */
  decrypt(encryptedText) {
    if (!this.encryptionKey) {
      throw new Error('XERO_ENCRYPTION_KEY not configured');
    }

    const key = Buffer.from(this.encryptionKey.substring(0, 32), 'utf-8');
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

module.exports = new XeroAuthService();
