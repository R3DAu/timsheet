const express = require('express');
const router = express.Router();
const xeroAuthController = require('../controllers/xeroAuthController');
const xeroSetupController = require('../controllers/xeroSetupController');
const xeroSyncController = require('../controllers/xeroSyncController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All Xero routes require authentication and admin privileges
router.use(requireAuth);
router.use(requireAdmin);

// === OAuth Authentication ===

// Initiate OAuth connection
router.get('/auth/connect', xeroAuthController.initiateOAuth);

// OAuth callback from Xero
router.get('/auth/callback', xeroAuthController.handleCallback);

// Get connected tenants
router.get('/auth/tenants', xeroAuthController.getTenants);

// Disconnect a tenant
router.post('/auth/disconnect/:tenantId', xeroAuthController.disconnectTenant);

// === Setup & Mapping ===

// Get Xero employees for a tenant
router.get('/setup/employees/:tenantId', xeroSetupController.getXeroEmployees);

// Map local employee to Xero employee
router.post('/setup/employees/map', xeroSetupController.mapEmployee);

// Get Xero earnings rates for a tenant
router.get('/setup/earnings-rates/:tenantId', xeroSetupController.getEarningsRates);

// Map local role to Xero earnings rate
router.post('/setup/earnings-rates/map', xeroSetupController.mapEarningsRate);

// Update employee Xero settings (ST/LT, auto-approve, sync enabled)
router.post('/setup/employee-settings', xeroSetupController.updateEmployeeSettings);

// Map company to Xero tenant
router.post('/setup/company-mapping', xeroSetupController.mapCompany);

// Get all current mappings
router.get('/setup/mappings', xeroSetupController.getMappings);

// Get Xero contacts for a tenant (for invoicing)
router.get('/setup/contacts/:tenantId', xeroSetupController.getXeroContacts);

// === Sync Operations ===

// Manually sync a timesheet
router.post('/sync/timesheet/:timesheetId', xeroSyncController.syncTimesheet);

// Get sync logs
router.get('/sync/logs', xeroSyncController.getSyncLogs);

// Get a specific sync log
router.get('/sync/logs/:id', xeroSyncController.getSyncLog);

// Get sync status for a timesheet
router.get('/sync/status/:timesheetId', xeroSyncController.getTimesheetSyncStatus);

// Get sync statistics
router.get('/sync/stats', xeroSyncController.getSyncStats);

module.exports = router;
