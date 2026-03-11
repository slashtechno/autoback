-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_apikey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "referenceId" TEXT NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refillInterval" INTEGER,
    "refillAmount" INTEGER,
    "lastRefillAt" DATETIME,
    "enabled" BOOLEAN DEFAULT true,
    "rateLimitEnabled" BOOLEAN DEFAULT true,
    "rateLimitTimeWindow" INTEGER DEFAULT 86400000,
    "rateLimitMax" INTEGER DEFAULT 10,
    "requestCount" INTEGER DEFAULT 0,
    "remaining" INTEGER,
    "lastRequest" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT
);
INSERT INTO "new_apikey" ("configId", "createdAt", "enabled", "expiresAt", "id", "key", "lastRefillAt", "lastRequest", "metadata", "name", "permissions", "prefix", "rateLimitEnabled", "rateLimitMax", "rateLimitTimeWindow", "referenceId", "refillAmount", "refillInterval", "remaining", "requestCount", "start", "updatedAt") SELECT "configId", "createdAt", "enabled", "expiresAt", "id", "key", "lastRefillAt", "lastRequest", "metadata", "name", "permissions", "prefix", "rateLimitEnabled", "rateLimitMax", "rateLimitTimeWindow", "referenceId", "refillAmount", "refillInterval", "remaining", "requestCount", "start", "updatedAt" FROM "apikey";
DROP TABLE "apikey";
ALTER TABLE "new_apikey" RENAME TO "apikey";
CREATE UNIQUE INDEX "apikey_key_key" ON "apikey"("key");
CREATE INDEX "apikey_configId_idx" ON "apikey"("configId");
CREATE INDEX "apikey_referenceId_idx" ON "apikey"("referenceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
