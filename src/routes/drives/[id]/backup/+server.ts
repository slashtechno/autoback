import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import prisma from '$lib/prisma';
import { backupProgress } from '$lib/server/backup-progress';

// Returns the current backup progress for a drive, or null if no backup is running
// https://kit.svelte.dev/docs/routing#server
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const drive = await prisma.drive.findUnique({ where: { id: params.id } });
	if (!drive) error(404, 'Drive not found');

	const progress = backupProgress[drive.path] ?? null;
	return json(progress);
};
