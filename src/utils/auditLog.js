/**
 * Audit log service.
 * Writes significant user actions to the AuditLog table.
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('./logger');

const prisma = new PrismaClient();

/**
 * Write an audit log entry.
 *
 * @param {Object} opts
 * @param {number|null} opts.userId   - The user performing the action
 * @param {string|null} [opts.userName] - Snapshot of user name (optional)
 * @param {string}      opts.action  - Action constant, e.g. 'TIMESHEET_APPROVED'
 * @param {string}      [opts.entity]  - Entity type, e.g. 'Timesheet'
 * @param {string|number} [opts.entityId] - PK of affected entity
 * @param {Object}      [opts.metadata] - Additional context (serialised as JSON)
 * @param {string}      [opts.ipAddress]
 */
async function audit(opts) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:    opts.userId ?? null,
        userName:  opts.userName ?? null,
        action:    opts.action,
        entity:    opts.entity ?? null,
        entityId:  opts.entityId != null ? String(opts.entityId) : null,
        metadata:  opts.metadata ? JSON.stringify(opts.metadata) : null,
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit failure must never crash the request
    logger.error('[Audit] Failed to write audit log', { error: err.message, opts });
  }
}

/**
 * Express middleware helper — extracts session context and returns a bound
 * audit() function pre-filled with userId, userName, and ipAddress.
 *
 * Usage in a controller:
 *   const log = auditFrom(req);
 *   await log('TIMESHEET_APPROVED', 'Timesheet', ts.id, { weekStarting: ts.weekStarting });
 */
function auditFrom(req) {
  const userId    = req.session?.userId ?? null;
  const userName  = req.session?.userName ?? null;
  const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || null;

  return (action, entity, entityId, metadata) =>
    audit({ userId, userName, ipAddress, action, entity, entityId, metadata });
}

module.exports = { audit, auditFrom };
