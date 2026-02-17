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
    let url = `${this.payrollAuUrl}/PayRuns`;
    if (status) {
      url += `?where=Status=="${status}"`;
    }
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayRuns || [];
  }

  /**
   * Get a single payrun by ID
   */
  async getPayrun(tenantId, payrunId) {
    const url = `${this.payrollAuUrl}/PayRuns/${payrunId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayRuns?.[0] || null;
  }

  /**
   * Create a new payrun
   */
  async createPayrun(tenantId, payrunData) {
    const url = `${this.payrollAuUrl}/PayRuns`;
    const response = await this.makeRequest('POST', url, tenantId, {
      PayRuns: [payrunData]
    });
    return response.PayRuns?.[0] || null;
  }

  /**
   * Get timesheets for a payrun
   */
  async getTimesheets(tenantId, payrunId = null) {
    let url = `${this.payrollAuUrl}/Timesheets`;
    if (payrunId) {
      url += `?where=PayrollCalendarID=="${payrunId}"`;
    }
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Timesheets || [];
  }

  /**
   * Get a single timesheet by ID
   */
  async getTimesheet(tenantId, timesheetId) {
    const url = `${this.payrollAuUrl}/Timesheets/${timesheetId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Timesheets?.[0] || null;
  }

  /**
   * Create a new timesheet
   */
  async createTimesheet(tenantId, timesheetData) {
    console.log('[XeroPayroll] Creating timesheet:', JSON.stringify(timesheetData, null, 2));

    const xero = await this.getXeroClient(tenantId);

    // Create timesheet object using SDK models
    const { Timesheet } = require('xero-node');
    const timesheet = Timesheet.constructFromObject(timesheetData);

    const response = await xero.payrollAUApi.createTimesheet(tenantId, [timesheet]);

    return response.body.timesheets?.[0] || null;
  }

  /**
   * Update an existing timesheet
   */
  async updateTimesheet(tenantId, timesheetId, timesheetData) {
    const url = `${this.payrollAuUrl}/Timesheets/${timesheetId}`;

    console.log('[XeroPayroll] Updating timesheet:', timesheetId);

    const response = await this.makeRequest('POST', url, tenantId, {
      Timesheets: [{ ...timesheetData, TimesheetID: timesheetId }]
    });

    return response.Timesheets?.[0] || null;
  }

  /**
   * Get leave applications
   */
  async getLeaveApplications(tenantId, employeeId = null) {
    let url = `${this.payrollAuUrl}/LeaveApplications`;
    if (employeeId) {
      url += `?where=EmployeeID=="${employeeId}"`;
    }
    const response = await this.makeRequest('GET', url, tenantId);
    return response.LeaveApplications || [];
  }

  /**
   * Create a leave application
   */
  async createLeaveApplication(tenantId, leaveData) {
    const url = `${this.payrollAuUrl}/LeaveApplications`;

    console.log('[XeroPayroll] Creating leave application:', JSON.stringify(leaveData, null, 2));

    const response = await this.makeRequest('POST', url, tenantId, {
      LeaveApplications: [leaveData]
    });

    return response.LeaveApplications?.[0] || null;
  }

  /**
   * Get employee leave balances
   */
  async getLeaveBalances(tenantId, employeeId) {
    const url = `${this.payrollAuUrl}/Employees/${employeeId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    const employee = response.Employees?.[0];
    return employee?.LeaveBalances || [];
  }

  /**
   * Get all contacts (for invoicing)
   */
  async getContacts(tenantId) {
    const url = `${this.baseUrl}/Contacts`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Contacts || [];
  }

  /**
   * Get a single contact by ID
   */
  async getContact(tenantId, contactId) {
    const url = `${this.baseUrl}/Contacts/${contactId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Contacts?.[0] || null;
  }

  /**
   * Get all invoices
   */
  async getInvoices(tenantId, status = null) {
    let url = `${this.baseUrl}/Invoices`;
    if (status) {
      url += `?where=Status=="${status}"`;
    }
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Invoices || [];
  }

  /**
   * Get a single invoice by ID
   */
  async getInvoice(tenantId, invoiceId) {
    const url = `${this.baseUrl}/Invoices/${invoiceId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Invoices?.[0] || null;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(tenantId, invoiceData) {
    const url = `${this.baseUrl}/Invoices`;

    console.log('[XeroPayroll] Creating invoice:', JSON.stringify(invoiceData, null, 2));

    const response = await this.makeRequest('POST', url, tenantId, {
      Invoices: [invoiceData]
    });

    return response.Invoices?.[0] || null;
  }

  /**
   * Update an existing invoice
   */
  async updateInvoice(tenantId, invoiceId, invoiceData) {
    const url = `${this.baseUrl}/Invoices/${invoiceId}`;

    console.log('[XeroPayroll] Updating invoice:', invoiceId);

    const response = await this.makeRequest('POST', url, tenantId, {
      Invoices: [{ ...invoiceData, InvoiceID: invoiceId }]
    });

    return response.Invoices?.[0] || null;
  }

  /**
   * Get payroll calendars
   */
  async getPayrollCalendars(tenantId) {
    const url = `${this.payrollAuUrl}/PayrollCalendars`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayrollCalendars || [];
  }
}

module.exports = new XeroPayrollService();
