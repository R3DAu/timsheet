const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized - Please log in' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
  next();
};

const optionalAuth = (req, res, next) => {
  // Continue regardless of auth status
  next();
};

/**
 * Checks X-API-Key header first, falls back to session auth.
 * On successful API key auth, sets req.session.userId and req.session.isAdmin
 * so downstream code works unchanged.
 */
const requireApiKeyOrAuth = async (req, res, next) => {
  // Check session first (already authenticated)
  if (req.session.userId) {
    return next();
  }

  // Check X-API-Key header
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized - Please log in or provide an API key' });
  }

  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true }
    });

    if (!keyRecord || !keyRecord.isActive) {
      return res.status(401).json({ error: 'Invalid or revoked API key' });
    }

    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: 'API key has expired' });
    }

    // Update last used timestamp (fire-and-forget)
    prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() }
    }).catch(() => {});

    // Set session-like properties so downstream code works
    req.session.userId = keyRecord.user.id;
    req.session.isAdmin = keyRecord.user.isAdmin;
    req.session.employeeId = null; // API key access doesn't have employee context
    req.apiKeyAuth = true; // Flag that this was API key auth

    next();
  } catch (error) {
    console.error('API key auth error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Like requireAdmin but also accepts API key auth.
 */
const requireApiKeyOrAdmin = async (req, res, next) => {
  // Try API key auth first if no session
  if (!req.session.userId) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
      try {
        const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const keyRecord = await prisma.apiKey.findUnique({
          where: { keyHash },
          include: { user: true }
        });

        if (!keyRecord || !keyRecord.isActive) {
          return res.status(401).json({ error: 'Invalid or revoked API key' });
        }

        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
          return res.status(401).json({ error: 'API key has expired' });
        }

        prisma.apiKey.update({
          where: { id: keyRecord.id },
          data: { lastUsedAt: new Date() }
        }).catch(() => {});

        req.session.userId = keyRecord.user.id;
        req.session.isAdmin = keyRecord.user.isAdmin;
        req.apiKeyAuth = true;
      } catch (error) {
        console.error('API key auth error:', error);
        return res.status(500).json({ error: 'Authentication error' });
      }
    }
  }

  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  requireApiKeyOrAuth,
  requireApiKeyOrAdmin
};
