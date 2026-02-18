const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requireAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * GET /api/audit-logs
 * Returns paginated audit log entries. Admin only.
 * Query params: page, limit, action, userId, entity, from, to
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.action) where.action = req.query.action;
    if (req.query.userId) where.userId = parseInt(req.query.userId);
    if (req.query.entity) where.entity = req.query.entity;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) where.createdAt.gte = new Date(req.query.from);
      if (req.query.to) where.createdAt.lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/audit-logs/actions
 * Returns distinct action values for filter dropdown. Admin only.
 */
router.get('/actions', requireAdmin, async (req, res) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' }
    });
    res.json({ actions: actions.map(a => a.action) });
  } catch (error) {
    console.error('Get audit log actions error:', error);
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

module.exports = router;
