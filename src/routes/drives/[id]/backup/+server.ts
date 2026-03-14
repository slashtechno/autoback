import { json, error } from '@sveltejs/kit';
import { access } from 'node:fs/promises';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import { backupProgress } from '$lib/server/backup-progress';
import { cancelBackup } from '$lib/watcher';
import { hostPath } from '$lib/server/host-path';

// Returns the current backup progress for a drive plus its mounted status.
// `progress` is null when no backup is running.
// https://kit.svelte.dev/docs/routing#server
// Example curl request with api key auth:
// curl -H "x-api-key: YOUR_API_KEY" http://localhost:5173/drives/DRIVE_ID/backup
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const drive = await prisma.drive.findUnique({ where: { id: params.id } });
	if (!drive) error(404, 'Drive not found');

	const mounted = await access(hostPath(drive.path)).then(() => true).catch(() => false);
	const progress = backupProgress[drive.path] ?? null;
	return json({ mounted, progress });
};

// Cancel an in-progress backup for this drive.
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const drive = await prisma.drive.findUnique({ where: { id: params.id } });
	if (!drive) error(404, 'Drive not found');

	cancelBackup(drive.path);
	return json({ ok: true });
};
