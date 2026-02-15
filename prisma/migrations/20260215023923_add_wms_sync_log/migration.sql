-- CreateTable
CREATE TABLE "WmsSyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timesheetId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "wmsUsername" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    "syncDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WmsSyncLog_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WmsSyncLog_timesheetId_idx" ON "WmsSyncLog"("timesheetId");

-- CreateIndex
CREATE INDEX "WmsSyncLog_status_idx" ON "WmsSyncLog"("status");
