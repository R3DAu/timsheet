# Timesheet Management System

A comprehensive timesheet management system for contractors with multiple roles, companies, and approval workflows.

## Features

### Core Functionality
- **Multi-Company Support**: Track work across multiple companies (billable and non-billable)
- **Employee Management**: Multiple employee IDs for different systems/integrations
- **Flexible Roles**: Employees can have multiple roles per company with different pay rates
- **Timesheet Tracking**: Weekly timesheets with detailed entries
- **Entry Types**:
  - General: Standard work hours
  - Travel: With from/to addresses and distance calculation
- **Status Workflow**: Complete lifecycle tracking (OPEN, INCOMPLETE, SUBMITTED, AWAITING_APPROVAL, APPROVED, LOCKED, PROCESSED)

### Advanced Features
- **Approval System**: Email notifications to designated approvers
- **Automated Reminders**: SMS and email reminders on Friday/Sunday evenings for unsubmitted timesheets
- **Google Maps Integration**: Distance calculation for travel entries with caching
- **Preset Addresses**: Save common locations (home, workplace, school) in employee profiles
- **Session-based Authentication**: Secure login system
- **RESTful API**: Complete API for integrations and reporting

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: SQLite with Prisma ORM
- **Authentication**: Express-session with bcrypt
- **Email**: Nodemailer
- **SMS**: Twilio
- **Maps**: Google Maps API
- **Frontend**: Vanilla JavaScript with simple, clean UI

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd timsheet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:
   - Database connection (SQLite by default)
   - Session secret
   - Email settings (SMTP)
   - Twilio credentials (for SMS)
   - Google Maps API key
   - Reminder settings

4. **Initialize the database**
   ```bash
   npx prisma migrate dev
   ```

5. **Seed the database with sample data**
   ```bash
   npm run db:seed
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

7. **Access the application**
   - Open your browser to `http://localhost:3000`
   - Default credentials:
     - Admin: `admin@example.com` / `admin123`
     - User: `user@example.com` / `user123`

## Configuration

### Email Settings
Configure SMTP settings in `.env` for email notifications:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Twilio SMS
For SMS reminders, add your Twilio credentials:
```env
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Google Maps API
For distance calculation on travel entries:
```env
GOOGLE_MAPS_API_KEY=your-api-key
```

### Reminders
Configure automated reminder times:
```env
REMINDER_FRIDAY_TIME=18:00
REMINDER_SUNDAY_TIME=18:00
REMINDER_ENABLED=true
```

## Database Schema

See [SCHEMA.md](./SCHEMA.md) for detailed database schema documentation.

### Key Entities
- **Users**: Authentication and user management
- **Companies**: Organizations to bill to
- **Employees**: Contractor profiles with preset addresses
- **EmployeeIdentifiers**: Multiple IDs per employee
- **Roles**: Job roles with pay rates
- **Timesheets**: Weekly timesheet records
- **TimesheetEntries**: Individual time entries (General or Travel)
- **TimesheetApprovers**: Designated approvers per company
- **PlaceCache**: Cached Google Maps results

## API Documentation

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Companies
- `GET /api/companies` - List all companies
- `GET /api/companies/:id` - Get company details
- `POST /api/companies` - Create company (admin)
- `PUT /api/companies/:id` - Update company (admin)
- `DELETE /api/companies/:id` - Delete company (admin)

### Employees
- `GET /api/employees` - List all employees
- `GET /api/employees/:id` - Get employee details
- `POST /api/employees` - Create employee (admin)
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee (admin)
- `POST /api/employees/:id/identifiers` - Add employee identifier
- `POST /api/employees/:id/roles` - Assign role to employee

### Roles
- `GET /api/roles?companyId=X` - List roles (optionally filter by company)
- `GET /api/roles/:id` - Get role details
- `POST /api/roles` - Create role (admin)
- `PUT /api/roles/:id` - Update role (admin)
- `DELETE /api/roles/:id` - Delete role (admin)

### Timesheets
- `GET /api/timesheets?employeeId=X&status=Y` - List timesheets
- `GET /api/timesheets/:id` - Get timesheet details
- `POST /api/timesheets` - Create timesheet
- `PUT /api/timesheets/:id` - Update timesheet
- `POST /api/timesheets/:id/submit` - Submit for approval
- `POST /api/timesheets/:id/approve` - Approve timesheet
- `POST /api/timesheets/:id/lock` - Lock timesheet (admin)
- `DELETE /api/timesheets/:id` - Delete timesheet

### Entries
- `GET /api/entries/timesheet/:timesheetId` - Get entries for timesheet
- `POST /api/entries` - Create entry
- `PUT /api/entries/:id` - Update entry
- `DELETE /api/entries/:id` - Delete entry

### Approvers
- `GET /api/approvers?companyId=X` - List approvers
- `POST /api/approvers` - Add approver (admin)
- `DELETE /api/approvers/:id` - Remove approver (admin)

### Maps
- `GET /api/maps/geocode?address=X` - Geocode address
- `GET /api/maps/distance?from=X&to=Y` - Calculate distance

## Usage

### Creating a Timesheet
1. Log in to the system
2. Navigate to "My Timesheets"
3. Click "Create Timesheet"
4. Select week start and end dates
5. Add entries for each day worked

### Adding Entries
1. Select a timesheet from the dropdown
2. Click "Add Entry"
3. Choose entry type (General or Travel)
4. Fill in details:
   - Date, hours, company, role
   - For travel: from/to addresses
5. Submit

### Travel Entries
- Use preset addresses from your profile (home, workplace, school)
- System automatically calculates distance using Google Maps
- Distance is cached to save API costs

### Submitting for Approval
1. Review all entries in your timesheet
2. Click "Submit" on the timesheet
3. Approvers receive email notifications
4. Track status in the system

### Reminders
- Automated reminders sent Friday and Sunday evenings (configurable)
- Employees receive email and SMS if timesheet not submitted
- Only applies to current week's timesheet

## Development

### Database Management

**View database in Prisma Studio:**
```bash
npm run db:studio
```

**Create a new migration:**
```bash
npx prisma migrate dev --name description_of_changes
```

**Reset database:**
```bash
npx prisma migrate reset
```

### Running Jobs Manually

**Test reminder system:**
```bash
npm run reminder:check
```

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure production database
3. Set secure session secret
4. Configure email and SMS for production
5. Set up SSL/TLS certificates
6. Use a process manager (PM2, systemd)
7. Set up reverse proxy (nginx)

## Security Notes

- Change default session secret in production
- Use strong passwords
- Keep API keys secure in `.env` (never commit)
- Configure CORS for production domains
- Use HTTPS in production
- Regular database backups

## Future Enhancements

- Export timesheets to CSV/PDF
- Advanced reporting and analytics
- Mobile app
- Integration with payroll systems
- Overtime tracking
- Project/task categorization
- Multi-week approval
- Timesheet templates

## Support

For issues or questions, please create an issue in the repository.

## License

ISC
