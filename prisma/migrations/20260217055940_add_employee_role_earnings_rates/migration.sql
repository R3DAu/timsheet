-- CreateTable
CREATE TABLE "EmployeeRoleEarningsRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "xeroTenantId" TEXT NOT NULL,
    "xeroEarningsRateId" TEXT NOT NULL,
    "earningsRateName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmployeeRoleEarningsRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeRoleEarningsRate_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EmployeeRoleEarningsRate_employeeId_idx" ON "EmployeeRoleEarningsRate"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRoleEarningsRate_roleId_idx" ON "EmployeeRoleEarningsRate"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRoleEarningsRate_employeeId_roleId_xeroTenantId_key" ON "EmployeeRoleEarningsRate"("employeeId", "roleId", "xeroTenantId");
