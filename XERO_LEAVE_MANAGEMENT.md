# Xero Leave Management - Phase 5 Complete! 🏖️

## Overview
Your timesheet system now has **full leave request workflow** with automatic Xero sync and leave balance display.

---

## ✨ Features

### For Employees
- **Submit leave requests** directly through the system
- **View leave balances** fetched from Xero in real-time
- **Track request status** (Pending, Approved, Rejected)
- **Manage own requests** (delete pending requests)

### For Administrators
- **Approve or reject** leave requests
- **Auto-sync to Xero** when approved
- **View all requests** across all employees
- **Track Xero sync status** for approved requests

---

## 🎯 How It Works

### Employee Workflow
```
Employee submits leave request
  ↓
Request status: PENDING
  ↓
Administrator reviews in Leave Management tab
  ↓
Approve → Syncs to Xero automatically
  OR
Reject → Request marked as rejected
  ↓
Employee sees updated status
```

### Leave Request Form
- **Leave Type**: Annual, Sick, Personal, or Unpaid
- **Start Date**: First day of leave
- **End Date**: Last day of leave
- **Total Hours**: Auto-calculated (assumes 8-hour work days)
- **Notes**: Optional notes/reason for leave

---

## 🖥️ Using the System

### As an Employee

**Submit a Leave Request:**
1. Navigate to **Leave Requests** tab in sidebar
2. Click **"New Leave Request"** button
3. Fill in the form:
   - Select leave type
   - Choose start and end dates
   - Add notes (optional)
4. Click **"Submit Request"**
5. Status will show as **PENDING**

**View Your Leave Balances:**
- Your Xero leave balances appear at the top of the Leave Requests page
- Shows hours available for each leave type
- Updates automatically from Xero

**Manage Your Requests:**
- View all your leave requests in the table
- Delete pending requests (before approval)
- See approval status and who approved

### As an Administrator

**Review Leave Requests:**
1. Navigate to **Leave Requests** tab
2. View **Pending Approval** section
3. See employee name, dates, hours, and notes

**Approve a Request:**
1. Click **"Approve"** button
2. Confirm approval
3. System automatically:
   - Updates status to APPROVED
   - Syncs to Xero as leave application
   - Stores Xero leave ID
   - Notifies employee (if configured)

**Reject a Request:**
1. Click **"Reject"** button
2. Confirm rejection
3. Request marked as REJECTED

**View Processed Requests:**
- Scroll to **Processed Requests** section
- See approved and rejected requests
- Check Xero sync status (✓ Synced or -)

---

## 🔧 Technical Details

### Database Schema
The system uses the `LeaveRequest` model:
```prisma
model LeaveRequest {
  id            Int      @id @default(autoincrement())
  employeeId    Int
  leaveType     String   // ANNUAL, SICK, PERSONAL, UNPAID
  startDate     DateTime
  endDate       DateTime
  totalHours    Float    // Auto-calculated
  status        String   // PENDING, APPROVED, REJECTED
  notes         String?
  approvedById  Int?
  approvedAt    DateTime?
  xeroLeaveId   String?  @unique  // Xero leave application ID
  xeroSyncedAt  DateTime?
  createdAt     DateTime @default(now())
}
```

### API Endpoints

**Employee Endpoints** (requires authentication):
- `POST /api/xero/leave/request` - Create leave request
- `GET /api/xero/leave/my-requests` - Get own requests
- `GET /api/xero/leave/balances` - Get leave balances from Xero
- `DELETE /api/xero/leave/request/:id` - Delete own pending request

**Admin Endpoints** (requires admin privileges):
- `GET /api/xero/leave/requests` - Get all requests
- `POST /api/xero/leave/approve/:id` - Approve and sync to Xero
- `POST /api/xero/leave/reject/:id` - Reject request

### Xero Sync Process
When a leave request is approved:
1. Check if employee has Xero sync enabled
2. Skip if employee is salaried (`isSalaried=true`)
3. Get employee's Xero employee ID
4. Determine Xero tenant from company mapping
5. Map leave type to Xero leave type:
   - `ANNUAL` → `ANNUAL_LEAVE`
   - `SICK` → `SICK_LEAVE`
   - `PERSONAL` → `PERSONAL_LEAVE`
   - `UNPAID` → `UNPAID_LEAVE`
6. Create leave application in Xero
7. Store `xeroLeaveId` locally
8. Log sync timestamp

**Note:** Sync failures don't block approval - requests are approved locally even if Xero sync fails.

---

## 🚫 Exclusions

The following employees are **excluded** from Xero leave sync:
- ❌ Employees with `syncEnabled=false` in Xero settings
- ❌ Salaried employees (`isSalaried=true`)
- ❌ Employees without Xero employee ID mapping

Leave requests for these employees can still be created and approved locally, but won't sync to Xero.

---

## 📊 Leave Balance Integration

**How balances work:**
- Fetched from Xero Payroll AU API
- Shows current balance for each leave type
- Updates in real-time when viewing the page
- Displays as beautiful cards with available hours

**If no balances show:**
- Employee may not have Xero sync enabled
- Employee may not be mapped to Xero
- Xero connection may not be active
- Check admin panel → Xero Setup to verify mapping

---

## 🎨 User Interface

### Employee View
- **Header**: "Leave Requests" with "New Leave Request" button
- **Leave Balances**: Gradient card showing all leave types with hours
- **Your Leave Requests**: Table with:
  - Leave type
  - Start/end dates
  - Total hours
  - Status badge (color-coded)
  - Approved by
  - Delete button (if pending)

### Admin View
- **Pending Approval**: Table of all pending requests
  - Employee name
  - Leave details
  - Notes
  - Approve/Reject buttons
- **Processed Requests**: Table of approved/rejected requests
  - Status badges
  - Xero sync indicator
  - Processed by username

---

## 🔍 Troubleshooting

### Leave request not syncing to Xero?
1. Check employee Xero mapping: Admin → Xero Setup → Employees
2. Verify employee has `syncEnabled=true`
3. Check if employee is salaried (`isSalaried=true` skips sync)
4. Verify Xero connection: Admin → Xero Setup → Connection
5. Check server logs for sync errors

### Leave balances not showing?
1. Ensure employee is mapped to Xero employee
2. Check Xero connection is active
3. Verify employee has leave entitlements in Xero
4. Check browser console for API errors

### Can't delete leave request?
- Only **pending** requests can be deleted
- Approved/rejected requests cannot be deleted
- Admins can delete any pending request
- Employees can only delete their own pending requests

---

## 🎯 Leave Type Mapping

The system maps internal leave types to Xero leave types:

| System Leave Type | Xero Leave Type  |
|-------------------|------------------|
| ANNUAL            | ANNUAL_LEAVE     |
| SICK              | SICK_LEAVE       |
| PERSONAL          | PERSONAL_LEAVE   |
| UNPAID            | UNPAID_LEAVE     |

**Note:** Leave types must be configured in Xero Payroll first. If a leave type doesn't exist in Xero, the sync will fail.

---

## ✅ Phase 5 Complete!

You now have:
- ✅ Full leave request workflow
- ✅ Automatic Xero sync on approval
- ✅ Real-time leave balance display
- ✅ Employee self-service portal
- ✅ Admin approval interface
- ✅ Audit trail with approval history

---

## 📝 What's Next?

**Completed Phases:**
- ✅ Phase 1: OAuth & Token Management
- ✅ Phase 2: Employee & Role Mapping
- ✅ Phase 3: Timesheet Sync
- ✅ Phase 5: Leave Request Workflow
- ✅ Phase 6: Automation & Scheduling

**Remaining Phases (Optional):**
- **Phase 4:** Invoice Management for Local Technicians
- **Phase 7:** Enhanced Reporting & Dashboard

**Recommendation:** Monitor leave requests for a week, then consider adding invoice management (Phase 4) if you have Local Technicians who need client billing.

---

## 🎉 Success!

Your leave management system is now live! Employees can:
1. Submit leave requests through the portal
2. View their leave balances from Xero
3. Track approval status

Administrators can:
1. Review and approve requests
2. See automatic Xero sync
3. Monitor all employee leave

**Questions?** Check the server logs or contact support.
