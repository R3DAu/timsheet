-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmployeeXeroSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "employeeType" TEXT NOT NULL DEFAULT 'ST',
    "autoApprove" BOOLEAN NOT NULL DEFAULT false,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isSalaried" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EmployeeXeroSettings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmployeeXeroSettings" ("autoApprove", "employeeId", "employeeType", "id", "syncEnabled") SELECT "autoApprove", "employeeId", "employeeType", "id", "syncEnabled" FROM "EmployeeXeroSettings";
DROP TABLE "EmployeeXeroSettings";
ALTER TABLE "new_EmployeeXeroSettings" RENAME TO "EmployeeXeroSettings";
CREATE UNIQUE INDEX "EmployeeXeroSettings_employeeId_key" ON "EmployeeXeroSettings"("employeeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
