-- CreateTable
CREATE TABLE "TsDataSyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "employeeId" INTEGER,
    "timesheetId" INTEGER,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "syncDetails" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Timesheet" ("approvedAt", "approvedById", "createdAt", "employeeId", "id", "status", "submittedAt", "updatedAt", "weekEnding", "weekStarting") SELECT "approvedAt", "approvedById", "createdAt", "employeeId", "id", "status", "submittedAt", "updatedAt", "weekEnding", "weekStarting" FROM "Timesheet";
DROP TABLE "Timesheet";
ALTER TABLE "new_Timesheet" RENAME TO "Timesheet";
CREATE UNIQUE INDEX "Timesheet_employeeId_weekStarting_key" ON "Timesheet"("employeeId", "weekStarting");
CREATE TABLE "new_TimesheetEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timesheetId" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "hours" REAL NOT NULL,
    "roleId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "tsDataSource" BOOLEAN NOT NULL DEFAULT false,
    "tsDataEntryId" TEXT,
    "tsDataSyncedAt" DATETIME,
    "startingLocation" TEXT,
    "reasonForDeviation" TEXT,
    "notes" TEXT,
    "privateNotes" TEXT,
    "locationNotes" TEXT,
    "travelFrom" TEXT,
    "travelTo" TEXT,
    "distance" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimesheetEntry" ("companyId", "createdAt", "date", "distance", "endTime", "entryType", "hours", "id", "locationNotes", "notes", "privateNotes", "reasonForDeviation", "roleId", "startTime", "startingLocation", "status", "timesheetId", "travelFrom", "travelTo", "updatedAt") SELECT "companyId", "createdAt", "date", "distance", "endTime", "entryType", "hours", "id", "locationNotes", "notes", "privateNotes", "reasonForDeviation", "roleId", "startTime", "startingLocation", "status", "timesheetId", "travelFrom", "travelTo", "updatedAt" FROM "TimesheetEntry";
DROP TABLE "TimesheetEntry";
ALTER TABLE "new_TimesheetEntry" RENAME TO "TimesheetEntry";
CREATE UNIQUE INDEX "TimesheetEntry_tsDataEntryId_key" ON "TimesheetEntry"("tsDataEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "TsDataSyncLog_syncType_status_idx" ON "TsDataSyncLog"("syncType", "status");

-- CreateIndex
CREATE INDEX "TsDataSyncLog_startedAt_idx" ON "TsDataSyncLog"("startedAt");
