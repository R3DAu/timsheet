const { PrismaClient } = require('@prisma/client');
const xeroPayrollService = require('./xeroPayrollService');

const prisma = new PrismaClient();

/**
 * Xero Leave Service
 * Handles leave request workflow and Xero sync
 */
class XeroLeaveService {
  constructor() {
    this.enabled = process.env.XERO_SYNC_ENABLED === 'true';
  }

  /**
   * Process an approved leave request and sync to Xero
   */
  async processApprovedLeave(leaveRequest) {
    if (!this.enabled) {
      console.log('[XeroLeave] Xero sync is disabled');
      return null;
    }

    try {
      // Load full leave request with employee details
      const fullLeave = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequest.id },
        include: {
          employee: {
            include: {
              identifiers: true,
              xeroSettings: true,
              roles: {
                include: {
                  role: {
                    include: {
                      company: {
                        include: {
                          xeroMappings: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Check if employee has Xero sync enabled
      if (!fullLeave.employee.xeroSettings?.syncEnabled) {
        console.log(`[XeroLeave] Sync disabled for employee ${fullLeave.employee.id}`);
        return null;
      }

      // Check if employee is salaried (skip leave sync for salaried)
      if (fullLeave.employee.xeroSettings?.isSalaried) {
        console.log(`[XeroLeave] Skipping leave sync for salaried employee ${fullLeave.employee.id}`);
        return null;
      }

      // Get Xero employee ID
      const xeroEmployeeId = fullLeave.employee.identifiers.find(
        i => i.identifierType === 'xero_employee_id'
      );

      if (!xeroEmployeeId) {
        throw new Error('Employee not mapped to Xero employee ID');
      }

      // Determine Xero tenant (use first company mapping)
      const firstRole = fullLeave.employee.roles[0];
      if (!firstRole || !firstRole.role.company.xeroMappings?.[0]) {
        throw new Error('No Xero tenant mapping found for employee');
      }

      const tenantId = firstRole.role.company.xeroMappings[0].xeroTenantId;

      // Map leave type to Xero leave type (returns { xeroLeaveTypeId, leaveTypeName })
      const { xeroLeaveTypeId, leaveTypeName } = await this.mapLeaveType(fullLeave.leaveType, tenantId);

      // Strip HTML tags from notes (Quill stores HTML, Xero only accepts plain text)
      const plainNotes = fullLeave.notes
        ? fullLeave.notes.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim()
        : '';

      // Build Xero leave application data
      // Note: Xero's UI "Description" field maps to the API `title` field.
      // There is no separate `description` field in Xero's Leave Application API.
      const xeroLeaveData = {
        employeeID: xeroEmployeeId.identifierValue,
        leaveTypeID: xeroLeaveTypeId,
        title: plainNotes || leaveTypeName,
        startDate: this.formatXeroDate(fullLeave.startDate),
        endDate: this.formatXeroDate(fullLeave.endDate)
      };

      // Create leave application in Xero
      console.log(`[XeroLeave] Syncing leave request ${fullLeave.id} to Xero tenant ${tenantId}`);

      const xeroLeave = await xeroPayrollService.createLeaveApplication(tenantId, xeroLeaveData);

      if (!xeroLeave || !xeroLeave.leaveApplicationID) {
        throw new Error('Failed to create Xero leave application - no ID returned');
      }

      // Update local leave request with Xero ID
      await prisma.leaveRequest.update({
        where: { id: fullLeave.id },
        data: {
          xeroLeaveId: xeroLeave.leaveApplicationID,
          xeroSyncedAt: new Date()
        }
      });

      console.log(`[XeroLeave] Successfully synced leave request ${fullLeave.id} to Xero (ID: ${xeroLeave.leaveApplicationID})`);

      return xeroLeave;
    } catch (error) {
      console.error(`[XeroLeave] Error syncing leave request ${leaveRequest.id}:`, error);
      // Don't throw - we don't want to block leave approval
      return null;
    }
  }

  /**
   * Map internal leave type to Xero leave type ID
   * Looks up mapping from database
   */
  async mapLeaveType(leaveType, tenantId) {
    try {
      const mapping = await prisma.xeroLeaveTypeMapping.findUnique({
        where: {
          xeroTenantId_leaveType: {
            xeroTenantId: tenantId,
            leaveType: leaveType
          }
        }
      });

      if (!mapping) {
        throw new Error(`Leave type ${leaveType} not mapped to Xero for tenant ${tenantId}. Please configure in Xero Setup.`);
      }

      return { xeroLeaveTypeId: mapping.xeroLeaveTypeId, leaveTypeName: mapping.leaveTypeName };
    } catch (error) {
      console.error(`[XeroLeave] Error mapping leave type ${leaveType}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a leave application in Xero and mark as rejected locally
   */
  async cancelLeave(leaveRequestId) {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          employee: {
            include: {
              roles: {
                include: {
                  role: {
                    include: {
                      company: {
                        include: { xeroMappings: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.xeroLeaveId) {
        const firstRole = leaveRequest.employee.roles[0];
        const tenantId = firstRole?.role?.company?.xeroMappings?.[0]?.xeroTenantId;
        if (tenantId) {
          try {
            await xeroPayrollService.deleteLeaveApplication(tenantId, leaveRequest.xeroLeaveId);
            console.log(`[XeroLeave] Cancelled Xero leave ${leaveRequest.xeroLeaveId}`);
          } catch (xeroError) {
            // Xero may reject deletion of processed leave — log but continue
            console.error(`[XeroLeave] Could not cancel Xero leave ${leaveRequest.xeroLeaveId}:`, xeroError.message);
          }
        }
      }

      return true;
    } catch (error) {
      console.error(`[XeroLeave] Error cancelling leave ${leaveRequestId}:`, error);
      return false;
    }
  }

  /**
   * Get employee leave balances from Xero
   */
  async getLeaveBalances(employeeId) {
    try {
      // Get employee with Xero details
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          identifiers: true,
          xeroSettings: true,
          roles: {
            include: {
              role: {
                include: {
                  company: {
                    include: {
                      xeroMappings: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Check if employee has Xero sync enabled
      if (!employee.xeroSettings?.syncEnabled) {
        return null;
      }

      // Get Xero employee ID
      const xeroEmployeeId = employee.identifiers.find(
        i => i.identifierType === 'xero_employee_id'
      );

      if (!xeroEmployeeId) {
        return null;
      }

      // Get Xero tenant
      const firstRole = employee.roles[0];
      if (!firstRole || !firstRole.role.company.xeroMappings?.[0]) {
        return null;
      }

      const tenantId = firstRole.role.company.xeroMappings[0].xeroTenantId;

      // Fetch leave balances from Xero
      const balances = await xeroPayrollService.getLeaveBalances(tenantId, xeroEmployeeId.identifierValue);

      return balances;
    } catch (error) {
      console.error(`[XeroLeave] Error fetching leave balances for employee ${employeeId}:`, error);
      return null;
    }
  }

  /**
   * Format date for Xero API (YYYY-MM-DD)
   */
  formatXeroDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculate total hours between two dates
   * Assumes 8 hour work days
   */
  calculateTotalHours(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return days * 8;
  }
}

module.exports = new XeroLeaveService();
