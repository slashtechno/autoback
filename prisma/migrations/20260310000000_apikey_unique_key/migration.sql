-- DropIndex
DROP INDEX "apikey_key_idx";

-- CreateIndex (unique)
CREATE UNIQUE INDEX "apikey_key_key" ON "apikey"("key");
