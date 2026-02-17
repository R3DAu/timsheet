-- CreateTable
CREATE TABLE "XeroLeaveTypeMapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "xeroTenantId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "xeroLeaveTypeId" TEXT NOT NULL,
    "leaveTypeName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "XeroLeaveTypeMapping_xeroTenantId_leaveType_key" ON "XeroLeaveTypeMapping"("xeroTenantId", "leaveType");
