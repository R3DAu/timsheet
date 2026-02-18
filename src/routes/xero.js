const express = require('express');
const router = express.Router();
const xeroAuthController = require('../controllers/xeroAuthController');
const xeroSetupController = require('../controllers/xeroSetupController');
const xeroSyncController = require('../controllers/xeroSyncController');
const xeroLeaveController = require('../controllers/xeroLeaveController');
const xeroInvoiceController = require('../controllers/xeroInvoiceController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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
router.post('/auth/disconnect/:tenantId', requireAdmin, xeroAuthController.disconnectTenant);

// === Setup & Mapping ===
// (Admin only)

// Get Xero employees for a tenant
router.get('/setup/employees/:tenantId', requireAdmin, xeroSetupController.getXeroEmployees);

// Map local employee to Xero employee
router.post('/setup/employees/map', requireAdmin, xeroSetupController.mapEmployee);

// Get Xero earnings rates for a tenant
router.get('/setup/earnings-rates/:tenantId', requireAdmin, xeroSetupController.getEarningsRates);

// Map local role to Xero earnings rate
router.post('/setup/earnings-rates/map', requireAdmin, xeroSetupController.mapEarningsRate);

// Update employee Xero settings (ST/LT, auto-approve, sync enabled)
router.post('/setup/employee-settings', requireAdmin, xeroSetupController.updateEmployeeSettings);

// Map company to Xero tenant
router.post('/setup/company-mapping', requireAdmin, xeroSetupController.mapCompany);

// Get all current mappings
router.get('/setup/mappings', requireAdmin, xeroSetupController.getMappings);

// Get Xero contacts for a tenant (for invoicing)
router.get('/setup/contacts/:tenantId', requireAdmin, xeroSetupController.getXeroContacts);

// Set employee-specific earnings rate override
router.post('/setup/employee-earnings-rate', requireAdmin, xeroSetupController.setEmployeeEarningsRate);

// Remove employee-specific earnings rate override
router.delete('/setup/employee-earnings-rate/:id', requireAdmin, xeroSetupController.deleteEmployeeEarningsRate);

// Get Xero leave types for a tenant
router.get('/setup/leave-types/:tenantId', requireAdmin, xeroSetupController.getXeroLeaveTypes);

// Map leave type to Xero leave type
router.post('/setup/leave-type-mapping', requireAdmin, xeroSetupController.mapLeaveType);

// Get payroll calendars with current pay run info
router.get('/setup/payroll-calendars/:tenantId', requireAdmin, xeroSetupController.getPayrollCalendars);

// Create the next pay run for a payroll calendar
router.post('/setup/payrun/create', requireAdmin, xeroSetupController.createPayRun);

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

// Get employee's leave balances from Xero (any authenticated user)
router.get('/leave/balances', xeroLeaveController.getLeaveBalances);

// Delete own leave request (any authenticated user, only if pending)
router.delete('/leave/request/:id', xeroLeaveController.deleteLeaveRequest);

// Get all leave requests (admin only)
router.get('/leave/requests', requireAdmin, xeroLeaveController.getAllLeaveRequests);

// Get all employee leave balances (admin only)
router.get('/leave/all-balances', requireAdmin, xeroLeaveController.getAllEmployeeBalances);

// Approve leave request (admin only)
router.post('/leave/approve/:id', requireAdmin, xeroLeaveController.approveLeaveRequest);

// Reject leave request (admin only)
router.post('/leave/reject/:id', requireAdmin, xeroLeaveController.rejectLeaveRequest);

// === Invoice Management ===
// (Admin only)

// List all invoices
router.get('/invoice/list', requireAdmin, xeroInvoiceController.listInvoices);

// Get a specific invoice
router.get('/invoice/:id', requireAdmin, xeroInvoiceController.getInvoice);

module.exports = router;
