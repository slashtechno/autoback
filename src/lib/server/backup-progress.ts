// Keyed by drive path → latest restic JSON update.
// A plain object works here because polling just reads the current value — no subscriptions needed.
// Node caches module imports, so this is a singleton shared across the whole process.
export const backupProgress: Record<string, Record<string, unknown>> = {};
