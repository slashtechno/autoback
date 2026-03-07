-- Add per-drive backup configuration columns.
-- All columns are nullable so existing drives keep working with zero-config defaults.
ALTER TABLE "drive" ADD COLUMN "excludeFile"    TEXT;
ALTER TABLE "drive" ADD COLUMN "keepSnapshots"  INTEGER;
