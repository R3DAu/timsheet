const xeroAuthService = require('../services/xeroAuthService');

/**
 * Xero OAuth Controller
 * Handles OAuth2 authentication flow
 */

/**
 * GET /api/xero/auth/connect
 * Initiate OAuth connection
 */
exports.initiateOAuth = async (req, res) => {
  try {
    const authUrl = await xeroAuthService.getAuthorizationUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('[XeroAuth] Error initiating OAuth:', error);
    res.status(500).json({
      error: 'Failed to initiate Xero connection',
      message: error.message
    });
  }
};

/**
 * GET /api/xero/auth/callback
 * Handle OAuth callback from Xero
 */
exports.handleCallback = async (req, res) => {
  try {
    const callbackUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    console.log('[XeroAuth] Processing OAuth callback:', callbackUrl);

    const tenants = await xeroAuthService.handleCallback(callbackUrl);

    // Redirect to admin panel with success message
    res.redirect('/admin?xero_connected=true&tenants=' + tenants.length);
  } catch (error) {
    console.error('[XeroAuth] OAuth callback error:', error);
    res.redirect('/admin?xero_error=' + encodeURIComponent(error.message));
  }
};

/**
 * GET /api/xero/auth/tenants
 * Get all connected Xero tenants (including inactive)
 */
exports.getTenants = async (req, res) => {
  try {
    const tenants = await xeroAuthService.getAllTenants();
    res.json(tenants);
  } catch (error) {
    console.error('[XeroAuth] Error fetching tenants:', error);
    res.status(500).json({
      error: 'Failed to fetch Xero tenants',
      message: error.message
    });
  }
};

/**
 * POST /api/xero/auth/disconnect/:tenantId
 * Disconnect a Xero tenant
 */
exports.disconnectTenant = async (req, res) => {
  try {
    const { tenantId } = req.params;

    await xeroAuthService.disconnectTenant(tenantId);

    res.json({
      success: true,
      message: 'Xero tenant disconnected successfully'
    });
  } catch (error) {
    console.error('[XeroAuth] Error disconnecting tenant:', error);
    res.status(500).json({
      error: 'Failed to disconnect Xero tenant',
      message: error.message
    });
  }
};
