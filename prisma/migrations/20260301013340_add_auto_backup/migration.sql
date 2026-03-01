-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_drive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "backupPath" TEXT NOT NULL,
    "resticKey" TEXT NOT NULL,
    "autoBackup" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_drive" ("backupPath", "createdAt", "id", "path", "resticKey", "updatedAt") SELECT "backupPath", "createdAt", "id", "path", "resticKey", "updatedAt" FROM "drive";
DROP TABLE "drive";
ALTER TABLE "new_drive" RENAME TO "drive";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
