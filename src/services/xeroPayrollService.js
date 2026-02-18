const { XeroClient } = require('xero-node');
const xeroAuthService = require('./xeroAuthService');

/**
 * Xero Payroll API Service
 * Uses xero-node SDK for Payroll AU API operations
 * Documentation: https://developer.xero.com/documentation/api/payrollau/overview
 */
class XeroPayrollService {
  constructor() {
    this.clientId = process.env.XERO_CLIENT_ID;
    this.clientSecret = process.env.XERO_CLIENT_SECRET;
    this.redirectUri = process.env.XERO_REDIRECT_URI;
  }

  /**
   * Get configured XeroClient with valid token
   */
  async getXeroClient(tenantId) {
    const accessToken = await xeroAuthService.getAccessToken(tenantId);

    const xero = new XeroClient({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
      redirectUris: [this.redirectUri],
      scopes: []  // Scopes already granted during OAuth
    });

    // Set the token manually
    await xero.setTokenSet({
      access_token: accessToken,
      token_type: 'Bearer'
    });

    return xero;
  }

  /**
   * Get all employees from Xero
   */
  async getEmployees(tenantId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getEmployees(tenantId);
    return response.body.employees || [];
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(tenantId, employeeId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getEmployee(tenantId, employeeId);
    return response.body.employees?.[0] || null;
  }

  /**
   * Get all earnings rates (pay types)
   */
  async getEarningsRates(tenantId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getPayItems(tenantId);
    return response.body.payItems?.earningsRates || [];
  }

  /**
   * Get all payruns
   */
  async getPayruns(tenantId, status = null) {
    const xero = await this.getXeroClient(tenantId);

    let where = null;
    if (status) {
      where = `Status=="${status}"`;
    }

    const response = await xero.payrollAUApi.getPayRuns(tenantId, null, where);
    return response.body.payRuns || [];
  }

  /**
   * Get a single payrun by ID
   */
  async getPayrun(tenantId, payrunId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getPayRun(tenantId, payrunId);
    return response.body.payRuns?.[0] || null;
  }

  /**
   * Create a new payrun for a payroll calendar.
   * Xero creates the next pay period in sequence for the given calendar.
   */
  async createPayrun(tenantId, payrunData) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.createPayRun(tenantId, [payrunData]);
    return response.body.payRuns?.[0] || null;
  }

  /**
   * Get timesheets for a specific employee
   */
  async getTimesheetsByEmployee(tenantId, employeeId) {
    const xero = await this.getXeroClient(tenantId);
    const where = `EmployeeID=="${employeeId}"`;
    const response = await xero.payrollAUApi.getTimesheets(tenantId, null, where);
    return response.body.timesheets || [];
  }

  /**
   * Get timesheets for a payrun
   */
  async getTimesheets(tenantId, payrunId = null) {
    const xero = await this.getXeroClient(tenantId);

    let where = null;
    if (payrunId) {
      where = `PayrollCalendarID=="${payrunId}"`;
    }

    const response = await xero.payrollAUApi.getTimesheets(tenantId, null, where);
    return response.body.timesheets || [];
  }

  /**
   * Get a single timesheet by ID
   */
  async getTimesheet(tenantId, timesheetId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getTimesheet(tenantId, timesheetId);
    return response.body.timesheets?.[0] || null;
  }

  /**
   * Create a new timesheet
   */
  async createTimesheet(tenantId, timesheetData) {
    console.log('[XeroPayroll] Creating timesheet:', JSON.stringify(timesheetData, null, 2));

    const xero = await this.getXeroClient(tenantId);

    // SDK accepts plain JavaScript objects
    const response = await xero.payrollAUApi.createTimesheet(tenantId, [timesheetData]);

    return response.body.timesheets?.[0] || null;
  }

  /**
   * Update an existing timesheet
   */
  async updateTimesheet(tenantId, timesheetId, timesheetData) {
    console.log('[XeroPayroll] Updating timesheet:', timesheetId);

    const xero = await this.getXeroClient(tenantId);

    // SDK accepts plain JavaScript objects
    const response = await xero.payrollAUApi.updateTimesheet(tenantId, timesheetId, [{
      ...timesheetData,
      timesheetID: timesheetId
    }]);

    return response.body.timesheets?.[0] || null;
  }

  /**
   * Get leave applications
   */
  async getLeaveApplications(tenantId, employeeId = null) {
    const xero = await this.getXeroClient(tenantId);

    let where = null;
    if (employeeId) {
      where = `EmployeeID=="${employeeId}"`;
    }

    const response = await xero.payrollAUApi.getLeaveApplications(tenantId, null, where);
    return response.body.leaveApplications || [];
  }

  /**
   * Create a leave application
   */
  async createLeaveApplication(tenantId, leaveData) {
    const xero = await this.getXeroClient(tenantId);

    // SDK accepts plain JavaScript objects
    const response = await xero.payrollAUApi.createLeaveApplication(tenantId, [leaveData]);

    return response.body.leaveApplications?.[0] || null;
  }

  /**
   * Delete a leave application from Xero
   * Note: Only SCHEDULED (not yet processed) leave can be deleted
   */
  async deleteLeaveApplication(tenantId, leaveApplicationId) {
    const xero = await this.getXeroClient(tenantId);
    await xero.payrollAUApi.deleteLeaveApplication(tenantId, leaveApplicationId);
  }

  /**
   * Get employee leave balances
   */
  async getLeaveBalances(tenantId, employeeId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getEmployee(tenantId, employeeId);
    const employee = response.body.employees?.[0];
    return employee?.leaveBalances || [];
  }

  /**
   * Get all contacts (for invoicing)
   */
  async getContacts(tenantId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.accountingApi.getContacts(tenantId);
    return response.body.contacts || [];
  }

  /**
   * Get a single contact by ID
   */
  async getContact(tenantId, contactId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.accountingApi.getContact(tenantId, contactId);
    return response.body.contacts?.[0] || null;
  }

  /**
   * Get all invoices
   */
  async getInvoices(tenantId, status = null) {
    const xero = await this.getXeroClient(tenantId);

    let where = null;
    if (status) {
      where = `Status=="${status}"`;
    }

    const response = await xero.accountingApi.getInvoices(tenantId, null, where);
    return response.body.invoices || [];
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(tenantId, invoiceId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.accountingApi.getInvoice(tenantId, invoiceId);
    return response.body.invoices?.[0] || null;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(tenantId, invoiceData) {
    console.log('[XeroPayroll] Creating invoice:', JSON.stringify(invoiceData, null, 2));

    const xero = await this.getXeroClient(tenantId);

    // SDK accepts plain JavaScript objects
    const response = await xero.accountingApi.createInvoices(tenantId, { invoices: [invoiceData] });

    return response.body.invoices?.[0] || null;
  }

  /**
   * Update an existing invoice
   */
  async updateInvoice(tenantId, invoiceId, invoiceData) {
    console.log('[XeroPayroll] Updating invoice:', invoiceId);

    const xero = await this.getXeroClient(tenantId);

    // SDK accepts plain JavaScript objects
    const response = await xero.accountingApi.updateInvoice(tenantId, invoiceId, {
      invoices: [{
        ...invoiceData,
        invoiceID: invoiceId
      }]
    });

    return response.body.invoices?.[0] || null;
  }

  /**
   * Get payroll calendars
   */
  async getPayrollCalendars(tenantId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getPayrollCalendars(tenantId);
    return response.body.payrollCalendars || [];
  }

  /**
   * Get leave types for a tenant
   * Leave types are part of the pay items in Xero Payroll AU
   */
  async getLeaveTypes(tenantId) {
    const xero = await this.getXeroClient(tenantId);
    const response = await xero.payrollAUApi.getPayItems(tenantId);

    // Extract leave types from pay items (payItems is an object, not an array)
    const payItems = response.body.payItems;
    const leaveTypes = payItems?.leaveTypes || [];

    return leaveTypes;
  }
}

module.exports = new XeroPayrollService();
