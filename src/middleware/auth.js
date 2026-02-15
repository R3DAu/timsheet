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

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth
};
