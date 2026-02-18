# Xero Automation - Phase 6 Complete! 🎉

## Overview
Your timesheet system now has **fully automated Xero sync** with weekly validation and email reports.

---

## 🤖 Automated Jobs

### 1. **Sunday Night Sync** (10 PM)
**What it does:**
- Auto-approves timesheets for employees with `autoApprove=true` (if enabled)
- Syncs all APPROVED timesheets that haven't been synced yet
- Skips salaried employees automatically
- Sends email report to all admins

**Runs:** Every Sunday at 10 PM (configurable via `XERO_SYNC_TIME`)

### 2. **Monday Morning Reconciliation** (6 AM)
**What it does:**
- Fetches last week's timesheets from Xero
- Compares local hours vs Xero hours by earnings rate
- Detects differences (tolerance: 0.1 hours / 6 minutes)
- Sends detailed reconciliation report with differences highlighted
- Local data is always the source of truth

**Runs:** Every Monday at 6 AM (configurable via `XERO_RECONCILIATION_TIME`)

---

## 📧 Email Reports

### Sunday Night Sync Report
**To:** All admin users
**Subject:** Xero Sync Report - [Date]

**Contains:**
- Auto-approval summary (if enabled)
- Sync results: Total, Success, Failed, Skipped
- Error details (if any)

### Monday Morning Reconciliation Report
**To:** All admin users
**Subject:** Xero Reconciliation Report - Week of [Date]

**Contains:**
- Validation summary
- Differences detected (with before/after comparison)
- Errors encountered
- Action items if differences found

---

## ⚙️ Environment Variables

Add to your `.env` file:

```bash
# Xero Automation
XERO_SYNC_ENABLED=true                    # Enable/disable all Xero jobs
XERO_SYNC_TIME=22:00                      # Sunday night sync time (HH:MM, 24-hour)
XERO_RECONCILIATION_TIME=06:00            # Monday morning reconciliation time
XERO_AUTO_APPROVE_ENABLED=false           # Enable auto-approval feature
```

**Current Settings:**
- ✅ Sync Enabled: `true`
- ⏰ Sync Time: Sunday 10:00 PM
- 🔍 Reconciliation Time: Monday 6:00 AM
- 🚫 Auto-Approve: `false` (disabled by default)

---

## 🎯 How It Works

### Workflow:
```
Week Ends (Saturday)
  ↓
Sunday 10 PM: Sync Job Runs
  ├─ Auto-approve timesheets? (if enabled)
  ├─ Sync APPROVED timesheets to Xero
  └─ Email report to admins
  ↓
Monday 6 AM: Reconciliation Job Runs
  ├─ Fetch timesheets from Xero
  ├─ Compare with local data
  ├─ Detect differences
  └─ Email report to admins
  ↓
Admins review reports & fix issues (if any)
```

### Auto-Approval (Optional):
1. Go to **Xero Setup → Settings**
2. Configure employee: Check **"Auto-approve timesheets"**
3. Set `XERO_AUTO_APPROVE_ENABLED=true` in `.env`
4. Restart server
5. Every Sunday at sync time, their SUBMITTED timesheets will be auto-approved and synced

---

## 🧪 Testing the Jobs

### Test Sunday Night Sync (Manual Run):
```javascript
// In Node.js console or via route
const { runXeroSyncJob } = require('./src/jobs/xero-sync');
await runXeroSyncJob();
```

### Test Monday Reconciliation (Manual Run):
```javascript
const { runReconciliationJob } = require('./src/jobs/xero-reconciliation');
await runReconciliationJob();
```

### Test Email Reports:
1. Ensure you have admin users in the database
2. Run the manual test above
3. Check email inbox for report

---

## 📊 What Gets Synced

**Included:**
- ✅ APPROVED timesheets
- ✅ Non-salaried employees
- ✅ Employees with `syncEnabled=true`
- ✅ Timesheets with proper role/earnings rate mappings

**Excluded:**
- ❌ DRAFT or SUBMITTED timesheets (unless auto-approved)
- ❌ Salaried employees (`isSalaried=true`)
- ❌ Employees with `syncEnabled=false`
- ❌ Already synced timesheets (have `xeroTimesheetId`)

---

## 🔧 Troubleshooting

### Jobs Not Running?
1. Check `XERO_SYNC_ENABLED=true` in `.env`
2. Restart server to reload scheduler
3. Check server logs for scheduler confirmation:
   ```
   Xero sync scheduled for Sundays at 22:00
   Xero reconciliation scheduled for Mondays at 06:00
   ```

### No Email Reports?
1. Verify admin users exist: `User.isAdmin = true`
2. Check email service configuration
3. Check server logs for send errors

### Differences Detected in Reconciliation?
- **Normal:** Local is source of truth, review and update Xero manually if needed
- **Common causes:** Manual edits in Xero, sync failures, rounding differences
- **Tolerance:** Differences < 0.1 hours (6 minutes) are ignored

---

## 🎛️ Manual Sync Override

You can still manually sync individual timesheets via:
- Admin panel → Xero Sync Logs → "Retry" button
- API: `POST /api/xero/sync/timesheet/:timesheetId`

Manual syncs bypass all checks and force re-sync.

---

## 📝 Next Steps

You now have:
- ✅ Phase 1: OAuth & Token Management
- ✅ Phase 2: Employee & Role Mapping
- ✅ Phase 3: Timesheet Sync
- ✅ Phase 6: Automation & Scheduling

**Remaining Phases (Optional):**
- **Phase 4:** Invoice Management for Local Techs
- **Phase 5:** Leave Request Workflow
- **Phase 7:** Enhanced Reporting & Dashboard

**Recommendation:** Let the automation run for 1-2 weeks, monitor the reports, then consider adding invoicing (Phase 4) if needed.

---

## 🎉 Success!

Your Xero payroll integration is now fully automated! Every week:
1. Timesheets sync automatically
2. Data is validated against Xero
3. You get email reports with any issues
4. Zero manual intervention needed (unless differences found)

**Questions?** Check the logs or email reports for detailed information.
