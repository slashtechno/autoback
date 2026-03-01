import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import prisma from '$lib/prisma';
import { Prisma } from '$lib/../generated/prisma/client';
import Restic from '$lib/restic';
import { addDriveToWatcher, removeDriveFromWatcher } from '$lib/watcher';
import { backupProgress } from '$lib/server/backup-progress';

// Fetch all drives (including resticKey, which lives server-side only) and their snapshots.
// resticKey is stripped before the data is returned to the browser.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) return fail(401, { message: 'Unauthorized' });

	const drives = await prisma.drive.findMany();
	const drivesForClient = drives.map(({ resticKey, ...d }) => d);

	// Run `restic snapshots` for each drive in parallel.
	// On error (e.g. repo not yet initialized), return an empty array rather than failing the page.
	const snapshotMap = Object.fromEntries(
		await Promise.all(
			drives.map(async (d) => {
				try {
					return [d.id, await new Restic(d.backupPath, d.resticKey, d.path).snapshots()];
				} catch {
					return [d.id, []];
				}
			})
		)
	);

	return { drives: drivesForClient, snapshots: snapshotMap };
};

export const actions = {
	// Create a new drive record and register it with the watcher immediately.
	create: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const payload: Prisma.DriveCreateInput = {
			path: data.get('path') as string,
			backupPath: data.get('backupPath') as string,
			resticKey: data.get('resticKey') as string
		};
		const newDrive = await prisma.drive.create({ data: payload });
		addDriveToWatcher(newDrive);
		throw redirect(303, '/drives');
	},

	// Remove a drive record. Optionally also deletes the restic repo directory from disk.
	delete: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const id = data.get('id') as string;

		const drive = await prisma.drive.findUnique({ where: { id } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		removeDriveFromWatcher(drive.path);

		if (data.get('deleteRepo') === 'on') {
			await fs.rm(drive.backupPath, { recursive: true, force: true });
		}

		await prisma.drive.delete({ where: { id } });
		throw redirect(303, '/drives');
	},

	// Kick off a manual backup without waiting for it to finish. The client polls
	// /drives/[id]/backup to get progress updates — same flow as an auto-backup.
	backup: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const id = data.get('id') as string;

		const drive = await prisma.drive.findUnique({ where: { id } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		(async () => {
			const restic = new Restic(drive.backupPath, drive.resticKey, drive.path);
			for await (const update of restic.backup()) {
				backupProgress[drive.path] = update;
			}
		})();

		throw redirect(303, '/drives');
	},

	// Persist the auto-backup toggle to the DB. The in-memory watcher reads this flag
	// from its own cached drive list on the next addDir event (i.e. next plug-in).
	toggleAutoBackup: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const id = data.get('id') as string;
		await prisma.drive.update({ where: { id }, data: { autoBackup: data.get('autoBackup') === 'on' } });
		throw redirect(303, '/drives');
	},

	// Delete a single snapshot and prune unreferenced data from the repo.
	deleteSnapshot: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const snapshotId = data.get('snapshotId') as string;

		const drive = await prisma.drive.findUnique({ where: { id: data.get('driveId') as string } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		await new Restic(drive.backupPath, drive.resticKey, drive.path).forget(snapshotId);
		throw redirect(303, '/drives');
	},

	// Restore a snapshot to a target path. Blocks until complete (may take a while for large repos).
	restore: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const snapshotId = data.get('snapshotId') as string;
		const targetPath = data.get('targetPath') as string;

		const drive = await prisma.drive.findUnique({ where: { id: data.get('driveId') as string } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		try {
			await new Restic(drive.backupPath, drive.resticKey, drive.path).restore(snapshotId, targetPath);
			return { message: `Restored ${snapshotId} to ${targetPath}` };
		} catch (err) {
			return fail(500, { message: `Restore failed: ${err}` });
		}
	}
} satisfies Actions;
