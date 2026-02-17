const axios = require('axios');
const xeroAuthService = require('./xeroAuthService');

/**
 * Xero Payroll API Service
 * Wraps direct Xero API calls for payroll operations
 * Documentation: https://developer.xero.com/documentation/api/payrollau/overview
 */
class XeroPayrollService {
  constructor() {
    // Base URL for Xero Payroll API (AU)
    this.baseUrl = 'https://api.xero.com/payroll.xro/1.0';
    this.accountingUrl = 'https://api.xero.com/api.xro/2.0';
  }

  /**
   * Make authenticated request to Xero API
   */
  async makeRequest(method, url, tenantId, data = null) {
    try {
      const accessToken = await xeroAuthService.getAccessToken(tenantId);

      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'xero-tenant-id': tenantId,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`[XeroPayroll] API request failed:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get all employees from Xero
   */
  async getEmployees(tenantId) {
    const url = `${this.baseUrl}/Employees`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Employees || [];
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(tenantId, employeeId) {
    const url = `${this.baseUrl}/Employees/${employeeId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Employees?.[0] || null;
  }

  /**
   * Get all earnings rates (pay types)
   */
  async getEarningsRates(tenantId) {
    const url = `${this.baseUrl}/PayItems`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayItems?.EarningsRates || [];
  }

  /**
   * Get all payruns
   */
  async getPayruns(tenantId, status = null) {
    let url = `${this.baseUrl}/PayRuns`;
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
    const url = `${this.baseUrl}/PayRuns/${payrunId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayRuns?.[0] || null;
  }

  /**
   * Create a new payrun
   */
  async createPayrun(tenantId, payrunData) {
    const url = `${this.baseUrl}/PayRuns`;
    const response = await this.makeRequest('POST', url, tenantId, {
      PayRuns: [payrunData]
    });
    return response.PayRuns?.[0] || null;
  }

  /**
   * Get timesheets for a payrun
   */
  async getTimesheets(tenantId, payrunId = null) {
    let url = `${this.baseUrl}/Timesheets`;
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
    const url = `${this.baseUrl}/Timesheets/${timesheetId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Timesheets?.[0] || null;
  }

  /**
   * Create a new timesheet
   */
  async createTimesheet(tenantId, timesheetData) {
    const url = `${this.baseUrl}/Timesheets`;

    console.log('[XeroPayroll] Creating timesheet:', JSON.stringify(timesheetData, null, 2));

    const response = await this.makeRequest('POST', url, tenantId, {
      Timesheets: [timesheetData]
    });

    return response.Timesheets?.[0] || null;
  }

  /**
   * Update an existing timesheet
   */
  async updateTimesheet(tenantId, timesheetId, timesheetData) {
    const url = `${this.baseUrl}/Timesheets/${timesheetId}`;

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
    let url = `${this.baseUrl}/LeaveApplications`;
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
    const url = `${this.baseUrl}/LeaveApplications`;

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
    const url = `${this.baseUrl}/Employees/${employeeId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    const employee = response.Employees?.[0];
    return employee?.LeaveBalances || [];
  }

  /**
   * Get all contacts (for invoicing)
   */
  async getContacts(tenantId) {
    const url = `${this.accountingUrl}/Contacts`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Contacts || [];
  }

  /**
   * Get a single contact by ID
   */
  async getContact(tenantId, contactId) {
    const url = `${this.accountingUrl}/Contacts/${contactId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Contacts?.[0] || null;
  }

  /**
   * Get all invoices
   */
  async getInvoices(tenantId, status = null) {
    let url = `${this.accountingUrl}/Invoices`;
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
    const url = `${this.accountingUrl}/Invoices/${invoiceId}`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.Invoices?.[0] || null;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(tenantId, invoiceData) {
    const url = `${this.accountingUrl}/Invoices`;

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
    const url = `${this.accountingUrl}/Invoices/${invoiceId}`;

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
    const url = `${this.baseUrl}/PayrollCalendars`;
    const response = await this.makeRequest('GET', url, tenantId);
    return response.PayrollCalendars || [];
  }
}

module.exports = new XeroPayrollService();
