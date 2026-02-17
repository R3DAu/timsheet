-- CreateTable
CREATE TABLE "XeroToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tenantId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "scope" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CompanyXeroMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "xeroTokenId" INTEGER NOT NULL,
    "xeroTenantId" TEXT NOT NULL,
    "xeroContactId" TEXT,
    "invoiceRate" REAL,
    CONSTRAINT "CompanyXeroMapping_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyXeroMapping_xeroTokenId_fkey" FOREIGN KEY ("xeroTokenId") REFERENCES "XeroToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XeroEarningsRateMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roleId" INTEGER NOT NULL,
    "xeroTenantId" TEXT NOT NULL,
    "xeroEarningsRateId" TEXT NOT NULL,
    "earningsRateName" TEXT NOT NULL,
    CONSTRAINT "XeroEarningsRateMapping_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XeroSyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "xeroTokenId" INTEGER,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "timesheetId" INTEGER,
    "xeroTimesheetId" TEXT,
    "xeroInvoiceId" TEXT,
    "xeroPayrunId" TEXT,
    "xeroLeaveId" TEXT,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsSuccess" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "syncDetails" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "XeroSyncLog_xeroTokenId_fkey" FOREIGN KEY ("xeroTokenId") REFERENCES "XeroToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "XeroSyncLog_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeXeroSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "employeeType" TEXT NOT NULL DEFAULT 'ST',
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EmployeeXeroSettings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "totalHours" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "xeroLeaveId" TEXT,
    "xeroSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XeroInvoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "xeroTenantId" TEXT NOT NULL,
    "xeroInvoiceId" TEXT,
    "invoiceMonth" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalHours" REAL NOT NULL DEFAULT 0,
    "hourlyRate" REAL NOT NULL,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "XeroInvoice_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "XeroInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XeroInvoiceEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "timesheetId" INTEGER NOT NULL,
    "hours" REAL NOT NULL,
    "description" TEXT,
    CONSTRAINT "XeroInvoiceEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "XeroInvoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "XeroInvoiceEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XeroPayrun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "xeroTenantId" TEXT NOT NULL,
    "xeroPayrunId" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timesheet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "weekStarting" DATETIME NOT NULL,
    "weekEnding" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "approvedById" INTEGER,
    "tsDataPeriodId" TEXT,
    "tsDataStatus" TEXT,
    "tsDataSyncedAt" DATETIME,
    "autoCreated" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "xeroTimesheetId" TEXT,
    "xeroSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Timesheet" ("approvedAt", "approvedById", "autoCreated", "createdAt", "employeeId", "id", "status", "submittedAt", "tsDataPeriodId", "tsDataStatus", "tsDataSyncedAt", "updatedAt", "verified", "weekEnding", "weekStarting") SELECT "approvedAt", "approvedById", "autoCreated", "createdAt", "employeeId", "id", "status", "submittedAt", "tsDataPeriodId", "tsDataStatus", "tsDataSyncedAt", "updatedAt", "verified", "weekEnding", "weekStarting" FROM "Timesheet";
DROP TABLE "Timesheet";
ALTER TABLE "new_Timesheet" RENAME TO "Timesheet";
CREATE UNIQUE INDEX "Timesheet_employeeId_weekStarting_key" ON "Timesheet"("employeeId", "weekStarting");
CREATE UNIQUE INDEX "Timesheet_xeroTimesheetId_key" ON "Timesheet"("xeroTimesheetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "XeroToken_tenantId_key" ON "XeroToken"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyXeroMapping_companyId_xeroTokenId_key" ON "CompanyXeroMapping"("companyId", "xeroTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroEarningsRateMapping_roleId_xeroTenantId_key" ON "XeroEarningsRateMapping"("roleId", "xeroTenantId");

-- CreateIndex
CREATE INDEX "XeroSyncLog_syncType_status_idx" ON "XeroSyncLog"("syncType", "status");

-- CreateIndex
CREATE INDEX "XeroSyncLog_timesheetId_idx" ON "XeroSyncLog"("timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeXeroSettings_employeeId_key" ON "EmployeeXeroSettings"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_xeroLeaveId_key" ON "LeaveRequest"("xeroLeaveId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_status_idx" ON "LeaveRequest"("employeeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "XeroInvoice_xeroInvoiceId_key" ON "XeroInvoice"("xeroInvoiceId");

-- CreateIndex
CREATE INDEX "XeroInvoice_status_idx" ON "XeroInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "XeroInvoice_employeeId_companyId_invoiceMonth_key" ON "XeroInvoice"("employeeId", "companyId", "invoiceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "XeroInvoiceEntry_invoiceId_timesheetId_key" ON "XeroInvoiceEntry"("invoiceId", "timesheetId");

-- CreateIndex
CREATE UNIQUE INDEX "XeroPayrun_xeroPayrunId_key" ON "XeroPayrun"("xeroPayrunId");

-- CreateIndex
CREATE INDEX "XeroPayrun_periodStart_status_idx" ON "XeroPayrun"("periodStart", "status");
