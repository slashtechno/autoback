import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { promises as fs } from 'node:fs';
import { access } from 'node:fs/promises';
import prisma from '$lib/prisma';
import { Prisma } from '$lib/../generated/prisma/client';
import Restic from '$lib/restic';
import { addDriveToWatcher, removeDriveFromWatcher, startManualBackup, updateDriveInWatcher } from '$lib/watcher';
import { hostPath, hostPrefix } from '$lib/server/host-path';
import { isPathReachable } from '$lib/server/path-check';
import { parseDiff } from '$lib/diff';

// Fetch all drives (including resticKey, which lives server-side only) and their snapshots.
// resticKey is stripped before the data is returned to the browser.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) return fail(401, { message: 'Unauthorized' });

	const drives = await prisma.drive.findMany();
	const drivesForClient = drives.map(({ resticKey, ...d }) => d);

	// Run per-drive checks and snapshot fetches in parallel.
	const [snapshotMap, mountedMap, repoReachableMap] = await Promise.all([
		// On error (e.g. repo not yet initialized), return an empty array rather than failing the page.
		Promise.all(drives.map(async (d) => {
			try {
				return [d.id, await new Restic(hostPath(d.backupPath), d.resticKey, hostPath(d.path)).snapshots()];
			} catch {
				return [d.id, []];
			}
		})).then(Object.fromEntries),

		// Source-path check: exact access only — a source dir that doesn't exist means drive unplugged.
		Promise.all(drives.map(async (d) => {
			try {
				await access(hostPath(d.path));
				return [d.id, true];
			} catch {
				return [d.id, false];
			}
		})).then(Object.fromEntries),

		// Repo-path check: parent-fallback allowed — restic creates the leaf dir on first backup.
		Promise.all(drives.map(async (d) => {
			return [d.id, await isPathReachable(hostPath(d.backupPath))];
		})).then(Object.fromEntries),
	]);

	return { drives: drivesForClient, snapshots: snapshotMap, mounted: mountedMap, repoReachable: repoReachableMap, hostPrefix };
};

export const actions = {
	// Create a new drive record and register it with the watcher immediately.
	create: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const payload: Prisma.DriveCreateInput = {
			path:       data.get('path')       as string,
			backupPath: data.get('backupPath') as string,
			resticKey:  data.get('resticKey')  as string,
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
			await fs.rm(hostPath(drive.backupPath), { recursive: true, force: true });
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

		try {
			await access(hostPath(drive.path));
		} catch {
			return fail(400, { message: 'Source directory is not accessible. Is the drive mounted?' });
		}

		if (!await isPathReachable(hostPath(drive.backupPath))) {
			return fail(400, { message: 'Backup repository path is unreachable. Is the backup drive mounted?' });
		}

		startManualBackup(drive); // fire-and-forget — client polls /drives/[id]/backup for progress

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

	// Save the optional per-drive configuration (exclude file path, snapshot retention).
	updateSettings: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const id = data.get('id') as string;

		const keepRaw = parseInt(data.get('keepSnapshots') as string, 10);
		const updated = await prisma.drive.update({
			where: { id },
			data: {
				excludeFile:   (data.get('excludeFile') as string) || null,
				keepSnapshots: keepRaw > 0 ? keepRaw : null,
			},
		});

		// Sync the watcher's in-memory drive cache so the next backup picks up new settings.
		updateDriveInWatcher(updated);

		throw redirect(303, '/drives');
	},

	// Run `restic check` to verify the repo's integrity.
	// Returns the output so the client can display it inline (via use:enhance).
	checkRepo: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const id = data.get('id') as string;

		const drive = await prisma.drive.findUnique({ where: { id } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		try {
			const result = await new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).check();
			return { driveId: id, checkResult: result };
		} catch (err) {
			return fail(500, { message: `Check failed: ${err}` });
		}
	},

	// Delete a single snapshot and prune unreferenced data from the repo.
	deleteSnapshot: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const snapshotId = data.get('snapshotId') as string;

		const drive = await prisma.drive.findUnique({ where: { id: data.get('driveId') as string } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		await new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).forget(snapshotId);
		throw redirect(303, '/drives');
	},

	// Diff a snapshot against its predecessor, returning grouped file changes.
	diffSnapshot: async ({ request, locals }) => {
		if (!locals.session) return fail(401, { message: 'Unauthorized' });

		const data = await request.formData();
		const snapshotId     = data.get('snapshotId')     as string;
		const prevSnapshotId = data.get('prevSnapshotId') as string;

		const drive = await prisma.drive.findUnique({ where: { id: data.get('driveId') as string } });
		if (!drive) return fail(404, { message: 'Drive not found' });

		try {
			const raw = await new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).diff(prevSnapshotId, snapshotId);
			return { snapshotId, groups: parseDiff(raw) };
		} catch (err) {
			return fail(500, { message: `Diff failed: ${err}` });
		}
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
			await new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).restore(snapshotId, hostPath(targetPath));
			return { message: `Restored ${snapshotId} to ${hostPath(targetPath)}` };
		} catch (err) {
			return fail(500, { message: `Restore failed: ${err}` });
		}
	}
} satisfies Actions;
