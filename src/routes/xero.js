const express = require('express');
const router = express.Router();
const xeroAuthController = require('../controllers/xeroAuthController');
const xeroSetupController = require('../controllers/xeroSetupController');
const xeroSyncController = require('../controllers/xeroSyncController');
const xeroLeaveController = require('../controllers/xeroLeaveController');
const xeroInvoiceController = require('../controllers/xeroInvoiceController');
const xeroReportingController = require('../controllers/xeroReportingController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const apiCache = require('../utils/apiCache');

// TTLs for Xero data categories (ms)
const TTL = {
  employees:       10 * 60 * 1000, // 10 min — changes when employees are added/renamed in Xero
  earningsRates:   30 * 60 * 1000, // 30 min — very stable
  contacts:        10 * 60 * 1000, // 10 min
  leaveTypes:      60 * 60 * 1000, // 60 min — almost never changes
  payrollCalendars: 5 * 60 * 1000, // 5 min  — invalidated on createPayRun
  leaveBalances:    2 * 60 * 1000, // 2 min  — changes after leave approved/rejected
  invoices:         5 * 60 * 1000, // 5 min
};

// All Xero routes require authentication
router.use(requireAuth);

// === OAuth Authentication ===
// (Admin only)

// Initiate OAuth connection
router.get('/auth/connect', requireAdmin, xeroAuthController.initiateOAuth);

// OAuth callback from Xero
router.get('/auth/callback', requireAdmin, xeroAuthController.handleCallback);

// Get connected tenants
router.get('/auth/tenants', requireAdmin, xeroAuthController.getTenants);

// Disconnect a tenant
router.post('/auth/disconnect/:tenantId', requireAdmin, (req, res, next) => {
  apiCache.invalidate('xero:'); // clear all Xero cache on disconnect
  next();
}, xeroAuthController.disconnectTenant);

// === Setup & Mapping ===
// (Admin only)

// Get Xero employees for a tenant
router.get('/setup/employees/:tenantId', requireAdmin,
  apiCache.middleware(req => `xero:employees:${req.params.tenantId}`, TTL.employees),
  xeroSetupController.getXeroEmployees);

// Map local employee to Xero employee (invalidates employee cache)
router.post('/setup/employees/map', requireAdmin, (req, res, next) => {
  apiCache.invalidate('xero:employees:');
  next();
}, xeroSetupController.mapEmployee);

// Get Xero earnings rates for a tenant
router.get('/setup/earnings-rates/:tenantId', requireAdmin,
  apiCache.middleware(req => `xero:earningsRates:${req.params.tenantId}`, TTL.earningsRates),
  xeroSetupController.getEarningsRates);

// Map local role to Xero earnings rate
router.post('/setup/earnings-rates/map', requireAdmin, xeroSetupController.mapEarningsRate);

// Update employee Xero settings (ST/LT, auto-approve, sync enabled)
router.post('/setup/employee-settings', requireAdmin, xeroSetupController.updateEmployeeSettings);

// Map company to Xero tenant
router.post('/setup/company-mapping', requireAdmin, xeroSetupController.mapCompany);

// Get all current mappings (Prisma only — no Xero API; no caching needed)
router.get('/setup/mappings', requireAdmin, xeroSetupController.getMappings);

// Get Xero contacts for a tenant (for invoicing)
router.get('/setup/contacts/:tenantId', requireAdmin,
  apiCache.middleware(req => `xero:contacts:${req.params.tenantId}`, TTL.contacts),
  xeroSetupController.getXeroContacts);

// Set employee-specific earnings rate override
router.post('/setup/employee-earnings-rate', requireAdmin, xeroSetupController.setEmployeeEarningsRate);

// Remove employee-specific earnings rate override
router.delete('/setup/employee-earnings-rate/:id', requireAdmin, xeroSetupController.deleteEmployeeEarningsRate);

// Get Xero leave types for a tenant
router.get('/setup/leave-types/:tenantId', requireAdmin,
  apiCache.middleware(req => `xero:leaveTypes:${req.params.tenantId}`, TTL.leaveTypes),
  xeroSetupController.getXeroLeaveTypes);

// Map leave type to Xero leave type
router.post('/setup/leave-type-mapping', requireAdmin, xeroSetupController.mapLeaveType);

// Get payroll calendars with current pay run info
router.get('/setup/payroll-calendars/:tenantId', requireAdmin,
  apiCache.middleware(req => `xero:payrollCalendars:${req.params.tenantId}`, TTL.payrollCalendars),
  xeroSetupController.getPayrollCalendars);

// Create the next pay run — invalidates payroll calendar cache
router.post('/setup/payrun/create', requireAdmin, (req, res, next) => {
  apiCache.invalidate('xero:payrollCalendars:');
  next();
}, xeroSetupController.createPayRun);

// === Sync Operations ===
// (Admin only)

// Manually sync a timesheet
router.post('/sync/timesheet/:timesheetId', requireAdmin, xeroSyncController.syncTimesheet);

// Get sync logs
router.get('/sync/logs', requireAdmin, xeroSyncController.getSyncLogs);

// Get a specific sync log
router.get('/sync/logs/:id', requireAdmin, xeroSyncController.getSyncLog);

// Get sync status for a timesheet
router.get('/sync/status/:timesheetId', requireAdmin, xeroSyncController.getTimesheetSyncStatus);

// Get sync statistics
router.get('/sync/stats', requireAdmin, xeroSyncController.getSyncStats);

// === Leave Management ===
// (Mixed: employees can manage own requests, admins can manage all)

// Create a leave request (any authenticated user)
router.post('/leave/request', xeroLeaveController.createLeaveRequest);

// Get employee's own leave requests (any authenticated user)
router.get('/leave/my-requests', xeroLeaveController.getMyLeaveRequests);

// Get employee's leave balances from Xero (any authenticated user) — keyed by session user
router.get('/leave/balances',
  apiCache.middleware(req => `xero:leaveBalances:user:${req.session.userId}`, TTL.leaveBalances),
  xeroLeaveController.getLeaveBalances);

// Delete own leave request — invalidate leave balance cache
router.delete('/leave/request/:id', (req, res, next) => {
  apiCache.invalidate('xero:leaveBalances:');
  next();
}, xeroLeaveController.deleteLeaveRequest);

// Get all leave requests (admin only)
router.get('/leave/requests', requireAdmin, xeroLeaveController.getAllLeaveRequests);

// Get all employee leave balances (admin only)
router.get('/leave/all-balances', requireAdmin,
  apiCache.middleware(() => 'xero:leaveBalances:all', TTL.leaveBalances),
  xeroLeaveController.getAllEmployeeBalances);

// Approve leave request — invalidate leave balances
router.post('/leave/approve/:id', requireAdmin, (req, res, next) => {
  apiCache.invalidate('xero:leaveBalances:');
  next();
}, xeroLeaveController.approveLeaveRequest);

// Reject leave request — invalidate leave balances
router.post('/leave/reject/:id', requireAdmin, (req, res, next) => {
  apiCache.invalidate('xero:leaveBalances:');
  next();
}, xeroLeaveController.rejectLeaveRequest);

// === Invoice Management ===
// (Admin only)

// List all invoices
router.get('/invoice/list', requireAdmin,
  apiCache.middleware(() => 'xero:invoices:list', TTL.invoices),
  xeroInvoiceController.listInvoices);

// Get a specific invoice
router.get('/invoice/:id', requireAdmin,
  apiCache.middleware(req => `xero:invoices:${req.params.id}`, TTL.invoices),
  xeroInvoiceController.getInvoice);

// === Reporting ===

router.get('/reporting/overview', requireAdmin,
  apiCache.middleware(() => 'xero:reporting:overview', 5 * 60 * 1000),
  xeroReportingController.getOverview);

module.exports = router;
