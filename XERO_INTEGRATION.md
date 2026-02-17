# Xero Payroll Integration - Setup Guide

## Phase 1: Foundation ✅ COMPLETE

The foundation has been successfully implemented with OAuth authentication, token management, and basic timesheet sync.

## Phase 2: Employee & Role Mapping UI ✅ COMPLETE

The complete admin UI for Xero setup and configuration has been implemented with visual mapping interfaces and sync monitoring.

### What's Been Implemented

#### Database Schema
- ✅ 9 new Xero models created (XeroToken, CompanyXeroMapping, XeroEarningsRateMapping, etc.)
- ✅ Migration applied to database
- ✅ Relations added to existing models (Timesheet, Employee, Company, Role, User)

#### Services
- ✅ **xeroAuthService.js** - OAuth2 authentication, token encryption (AES-256-CBC), auto-refresh
- ✅ **xeroPayrollService.js** - Xero API wrapper for payroll, timesheets, invoices, leave
- ✅ **xeroSyncService.js** - Orchestration layer for syncing timesheets to Xero

#### Controllers & Routes
- ✅ **xeroAuthController.js** - OAuth endpoints
- ✅ **xeroSetupController.js** - Employee/role/company mapping endpoints
- ✅ **xeroSyncController.js** - Manual sync and log viewing endpoints
- ✅ Routes registered at `/api/xero/*`

#### Integration Points
- ✅ Xero sync hook added to timesheet approval (non-blocking)
- ✅ Environment variables configured

---

## Setup Instructions

### 1. Environment Configuration

Add these variables to your `.env` file:

```bash
# Xero Integration
XERO_SYNC_ENABLED=true
XERO_SYNC_TIME=22:00
XERO_ENCRYPTION_KEY=your-32-char-encryption-key-change-this
XERO_CLIENT_ID=your-xero-oauth-client-id
XERO_CLIENT_SECRET=your-xero-oauth-client-secret
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/auth/callback
```

#### Getting Xero OAuth Credentials

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Create a new app (or use existing)
3. Copy **Client ID** → `XERO_CLIENT_ID`
4. Copy **Client Secret** → `XERO_CLIENT_SECRET`
5. Add redirect URI: `https://yourdomain.com/api/xero/auth/callback` → `XERO_REDIRECT_URI`
6. Required scopes:
   - `accounting.transactions`
   - `accounting.contacts`
   - `payroll.employees`
   - `payroll.payruns`
   - `payroll.timesheets`
   - `payroll.settings`

#### Generating Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output to `XERO_ENCRYPTION_KEY`.

---

### 2. Connect Xero Account

1. Log in as an **admin** user
2. Navigate to Admin Panel
3. Click **"Connect Xero"** (UI to be created in Phase 2)
4. Authorize your Xero organization
5. You'll be redirected back with success message

**API Endpoint (manual testing):**
```bash
GET /api/xero/auth/connect
```

This returns an `authUrl` - open it in a browser to authorize.

---

### 3. Phase 2 Setup (Employee & Role Mapping)

Once connected, you need to map:

1. **Employees**: Local employee → Xero employee ID
2. **Roles**: Local role → Xero earnings rate
3. **Employee Types**: Set ST (Specialist Tech) or LT (Local Tech)
4. **Companies**: Map to Xero tenant

**API Endpoints:**
- `GET /api/xero/setup/employees/:tenantId` - Fetch Xero employees
- `POST /api/xero/setup/employees/map` - Map employee
- `GET /api/xero/setup/earnings-rates/:tenantId` - Fetch earnings rates
- `POST /api/xero/setup/earnings-rates/map` - Map role to earnings rate
- `POST /api/xero/setup/employee-settings` - Set employee type (ST/LT)
- `POST /api/xero/setup/company-mapping` - Map company to Xero tenant

---

### 4. Test Timesheet Sync

1. Approve a timesheet (must have mapped employee + role)
2. Check sync logs: `GET /api/xero/sync/logs`
3. Verify in Xero: Payroll → Timesheets

**Manual Sync:**
```bash
POST /api/xero/sync/timesheet/:timesheetId
```

---

## API Endpoints Reference

### Authentication
- `GET /api/xero/auth/connect` - Get OAuth URL
- `GET /api/xero/auth/callback` - OAuth callback (automatic)
- `GET /api/xero/auth/tenants` - List connected tenants
- `POST /api/xero/auth/disconnect/:tenantId` - Disconnect tenant

### Setup & Mapping
- `GET /api/xero/setup/employees/:tenantId` - Fetch Xero employees
- `POST /api/xero/setup/employees/map` - Map employee
  ```json
  {
    "employeeId": 1,
    "xeroEmployeeId": "abc-123",
    "companyId": null
  }
  ```
- `GET /api/xero/setup/earnings-rates/:tenantId` - Fetch earnings rates
- `POST /api/xero/setup/earnings-rates/map` - Map role
  ```json
  {
    "roleId": 1,
    "xeroTenantId": "tenant-id",
    "xeroEarningsRateId": "rate-id",
    "earningsRateName": "Ordinary Hours"
  }
  ```
- `POST /api/xero/setup/employee-settings` - Configure employee
  ```json
  {
    "employeeId": 1,
    "employeeType": "ST",
    "autoApprove": false,
    "syncEnabled": true
  }
  ```
- `POST /api/xero/setup/company-mapping` - Map company
  ```json
  {
    "companyId": 1,
    "xeroTokenId": 1,
    "xeroTenantId": "tenant-id",
    "invoiceRate": 150.00
  }
  ```
- `GET /api/xero/setup/mappings` - Get all mappings
- `GET /api/xero/setup/contacts/:tenantId` - Fetch Xero contacts (for invoicing)

### Sync Operations
- `POST /api/xero/sync/timesheet/:timesheetId` - Manual sync
- `GET /api/xero/sync/logs` - List sync logs
  - Query params: `timesheetId`, `syncType`, `status`, `limit`, `offset`
- `GET /api/xero/sync/logs/:id` - Get specific log
- `GET /api/xero/sync/status/:timesheetId` - Get sync status
- `GET /api/xero/sync/stats` - Sync statistics

---

## How It Works

### Timesheet Approval Flow

```
1. Admin approves timesheet
   ↓
2. Status → APPROVED
   ↓
3. Email notification sent
   ↓
4. Xero sync triggered (if XERO_SYNC_ENABLED=true)
   ↓
5. xeroSyncService.processApprovedTimesheet()
   ↓
6. Check employee has sync enabled
   ↓
7. Get Xero employee ID from EmployeeIdentifier
   ↓
8. Determine tenant from CompanyXeroMapping
   ↓
9. Group entries by XeroEarningsRateMapping
   ↓
10. Create draft timesheet in Xero
    ↓
11. Store xeroTimesheetId in local DB
    ↓
12. Log sync operation in XeroSyncLog
    ↓
13. For LT employees: add to monthly invoice (Phase 4)
```

### Token Management

- **Storage**: Tokens encrypted with AES-256-CBC
- **Auto-refresh**: Checked on every API call, refreshed if < 5 min to expiry
- **Encryption key**: 32-character key from `XERO_ENCRYPTION_KEY`
- **Format**: `iv:encrypted` where IV is 16-byte random

---

## Security Considerations

1. **Token Encryption**: All access/refresh tokens encrypted at rest
2. **Admin-Only**: All Xero endpoints require `requireAdmin` middleware
3. **HTTPS Required**: OAuth callback must use HTTPS in production
4. **Encryption Key Rotation**: If rotating key, decrypt with old key → re-encrypt with new
5. **Audit Trail**: All sync operations logged in XeroSyncLog

---

## Troubleshooting

### "No active Xero token found"
- Reconnect your Xero account via `/api/xero/auth/connect`
- Check token hasn't been disconnected

### "Employee not mapped to Xero employee ID"
- Map the employee: `POST /api/xero/setup/employees/map`

### "No earnings rate mappings found"
- Map the role to a Xero earnings rate: `POST /api/xero/setup/earnings-rates/map`

### "Company not mapped to Xero tenant"
- Map the company: `POST /api/xero/setup/company-mapping`

### Token refresh failed
- Token may be revoked in Xero
- Disconnect and reconnect tenant

### Check sync logs
```bash
GET /api/xero/sync/logs?status=ERROR&limit=10
```

---

## Next Phases (Roadmap)

### Phase 2: Employee & Role Mapping UI ✅ COMPLETE
- ✅ Admin UI for mapping employees, roles, companies
- ✅ Visual mapping wizard
- ✅ OAuth connection wizard with popup
- ✅ Multi-tenant support
- ✅ Sync logs viewer with statistics
- ✅ Manual retry functionality

### Phase 3: Timesheet Sync ⏳
- Enhanced validation
- Reconciliation logic
- Sync retry mechanism

### Phase 4: Invoice Management ⏳
- Monthly invoice generation for LT employees
- Invoice sending workflow
- Invoice tracking

### Phase 5: Leave Management ⏳
- Leave request form
- Approval workflow
- Xero leave sync
- Balance fetching

### Phase 6: Automation & Scheduling ⏳
- Sunday night sync job (22:00)
- Monday morning reconciliation (06:00)
- Auto-approval for flagged employees
- Email reports

### Phase 7: Validation & Reporting ⏳
- Sync status indicators in UI
- Reconciliation reports
- Dashboard with statistics
- Difference detection & auto-fix

---

## Current Limitations

- ✅ OAuth connection working
- ✅ Manual timesheet sync working
- ✅ Full admin UI (Phase 2)
- ✅ Sync logs and monitoring
- ✅ Employee/role/company mapping interfaces
- ❌ No automated sync job (Phase 6)
- ❌ No reconciliation (Phase 7)
- ❌ No invoice management (Phase 4)
- ❌ No leave management (Phase 5)

---

## Testing Checklist

### Phase 1 Testing
- [ ] Can initiate OAuth connection
- [ ] OAuth callback stores encrypted tokens
- [ ] Can list connected Xero tenants
- [ ] Token auto-refreshes on expiry
- [ ] Can disconnect tenant
- [ ] Timesheet approval triggers sync
- [ ] Draft timesheet created in Xero
- [ ] xeroTimesheetId stored locally
- [ ] Sync log created
- [ ] Failed sync doesn't block approval

---

## Support

For issues or questions:
1. Check sync logs: `GET /api/xero/sync/logs?status=ERROR`
2. Verify mappings: `GET /api/xero/setup/mappings`
3. Check environment variables are set correctly
4. Ensure Xero app has correct scopes and redirect URI
