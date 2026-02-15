const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Timesheet Management System API',
      version: '1.0.0',
      description: 'API for managing timesheets, employees, companies, roles, and approvals',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie authentication. Login via POST /api/auth/login first.'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string' },
            name: { type: 'string' },
            isAdmin: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Company: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            isBillable: { type: 'boolean' }
          }
        },
        Employee: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            userId: { type: 'integer' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string', nullable: true },
            presetAddresses: { type: 'string', nullable: true, description: 'JSON string of preset address labels' }
          }
        },
        Role: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            companyId: { type: 'integer' },
            payRate: { type: 'number' }
          }
        },
        Timesheet: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            employeeId: { type: 'integer' },
            weekStarting: { type: 'string', format: 'date' },
            weekEnding: { type: 'string', format: 'date' },
            status: {
              type: 'string',
              enum: ['OPEN', 'INCOMPLETE', 'SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'LOCKED', 'UNLOCKED', 'PROCESSED']
            },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            approvedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        TimesheetEntry: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            timesheetId: { type: 'integer' },
            entryType: { type: 'string', enum: ['GENERAL', 'TRAVEL'] },
            date: { type: 'string', format: 'date' },
            startTime: { type: 'string', description: 'HH:MM format e.g. 07:00' },
            endTime: { type: 'string', description: 'HH:MM format e.g. 17:00' },
            hours: { type: 'number', description: 'Auto-calculated from start/end time' },
            roleId: { type: 'integer' },
            companyId: { type: 'integer' },
            status: {
              type: 'string',
              enum: ['OPEN', 'INCOMPLETE', 'SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'LOCKED', 'UNLOCKED', 'PROCESSED']
            },
            notes: { type: 'string', nullable: true, description: 'Rich HTML content (public notes)' },
            locationNotes: { type: 'string', nullable: true, description: 'JSON array of {location, description} pairs with HTML descriptions' },
            privateNotes: { type: 'string', nullable: true, description: 'Internal-only notes, not visible to clients' },
            travelFrom: { type: 'string', nullable: true },
            travelTo: { type: 'string', nullable: true },
            distance: { type: 'number', nullable: true }
          }
        },
        EmployeeIdentifier: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            employeeId: { type: 'integer' },
            identifierType: { type: 'string' },
            identifierValue: { type: 'string' },
            companyId: { type: 'integer', nullable: true }
          }
        },
        TimesheetApprover: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            companyId: { type: 'integer' },
            userId: { type: 'integer' },
            email: { type: 'string' }
          }
        }
      }
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management (admin)' },
      { name: 'Companies', description: 'Company management' },
      { name: 'Employees', description: 'Employee management' },
      { name: 'Roles', description: 'Role management' },
      { name: 'Timesheets', description: 'Timesheet operations' },
      { name: 'Entries', description: 'Timesheet entry operations' },
      { name: 'Approvers', description: 'Timesheet approver management' },
      { name: 'Maps', description: 'Google Maps geocoding and distance' }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
