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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Timesheet_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Timesheet" ("approvedAt", "approvedById", "autoCreated", "createdAt", "employeeId", "id", "status", "submittedAt", "tsDataPeriodId", "tsDataStatus", "tsDataSyncedAt", "updatedAt", "weekEnding", "weekStarting") SELECT "approvedAt", "approvedById", "autoCreated", "createdAt", "employeeId", "id", "status", "submittedAt", "tsDataPeriodId", "tsDataStatus", "tsDataSyncedAt", "updatedAt", "weekEnding", "weekStarting" FROM "Timesheet";
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
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "startingLocation" TEXT,
    "startingLocationLat" REAL,
    "startingLocationLng" REAL,
    "reasonForDeviation" TEXT,
    "notes" TEXT,
    "privateNotes" TEXT,
    "locationNotes" TEXT,
    "travelFrom" TEXT,
    "travelFromLat" REAL,
    "travelFromLng" REAL,
    "travelTo" TEXT,
    "travelToLat" REAL,
    "travelToLng" REAL,
    "distance" REAL,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimesheetEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimesheetEntry" ("companyId", "createdAt", "date", "distance", "endTime", "entryType", "hours", "id", "isBillable", "locationNotes", "notes", "privateNotes", "reasonForDeviation", "roleId", "startTime", "startingLocation", "startingLocationLat", "startingLocationLng", "status", "timesheetId", "travelFrom", "travelFromLat", "travelFromLng", "travelTo", "travelToLat", "travelToLng", "tsDataEntryId", "tsDataSource", "tsDataSyncedAt", "updatedAt") SELECT "companyId", "createdAt", "date", "distance", "endTime", "entryType", "hours", "id", "isBillable", "locationNotes", "notes", "privateNotes", "reasonForDeviation", "roleId", "startTime", "startingLocation", "startingLocationLat", "startingLocationLng", "status", "timesheetId", "travelFrom", "travelFromLat", "travelFromLng", "travelTo", "travelToLat", "travelToLng", "tsDataEntryId", "tsDataSource", "tsDataSyncedAt", "updatedAt" FROM "TimesheetEntry";
DROP TABLE "TimesheetEntry";
ALTER TABLE "new_TimesheetEntry" RENAME TO "TimesheetEntry";
CREATE UNIQUE INDEX "TimesheetEntry_tsDataEntryId_key" ON "TimesheetEntry"("tsDataEntryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
