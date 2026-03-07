import { access } from 'node:fs/promises';
import { dirname, parse } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { Prisma } from '$lib/../generated/prisma/client';
// To allow us to run watcher.ts directly, we can't import Prisma since it needs to load env vars via Vite env functions
import Restic from './restic';
import { backupProgress } from './server/backup-progress';
import { hostPath } from './server/host-path';

// Walk up targetPath until we find a directory that exists. Used when a watched path
// and some of its ancestors are deleted — we watch the deepest surviving ancestor so
// that chokidar's recursive scanning picks up the re-creation of the original path.
async function deepestExistingAncestor(targetPath: string): Promise<string> {
	const root = parse(targetPath).root;
	let current = dirname(targetPath);
	while (current !== root) {
		try {
			await access(current);
			return current;
		} catch {
			current = dirname(current);
		}
	}
	return root;
}

const driveSelect = {
	path:          true,
	backupPath:    true,
	resticKey:     true,
	autoBackup:    true,
	excludeFile:   true,
	keepSnapshots: true,
} satisfies Prisma.DriveSelect;

type WatchedDrive = Prisma.DriveGetPayload<{ select: typeof driveSelect }>;

// Module-level state so external callers can add/remove/update drives without restarting the watcher
let watcher: FSWatcher | null = null;
let watchedDrives: WatchedDrive[] = [];
const watchedPaths: string[] = [];
// target path → temporary anchor being watched (only set when parent is also gone)
const anchorWatchers = new Map<string, string>();
// drive path → AbortController for any currently running backup
const backupAbortControllers = new Map<string, AbortController>();

// Build ResticOptions from a WatchedDrive, applying the host prefix to any file paths.
function resticOptions(drive: WatchedDrive) {
	return {
		excludeFile:   drive.excludeFile   ? hostPath(drive.excludeFile) : undefined,
		keepSnapshots: drive.keepSnapshots ?? undefined,
	};
}

// Add a newly-created drive to the running watcher without restarting the server
export function addDriveToWatcher(drive: WatchedDrive) {
	watchedDrives.push(drive);
	watchedPaths.push(hostPath(drive.path));
	watcher?.add(hostPath(drive.path));
}

// Remove a deleted drive from the running watcher and clean up any stale progress
export function removeDriveFromWatcher(path: string) {
	backupAbortControllers.get(path)?.abort();
	backupAbortControllers.delete(path);
	watchedDrives = watchedDrives.filter((d) => d.path !== path);
	const idx = watchedPaths.indexOf(hostPath(path));
	if (idx !== -1) watchedPaths.splice(idx, 1);
	watcher?.unwatch(hostPath(path));
	delete backupProgress[path]; // clear any leftover progress state
}

// Sync updated drive settings (exclude file, retention) into the in-memory watcher state.
export function updateDriveInWatcher(drive: WatchedDrive) {
	const idx = watchedDrives.findIndex((d) => d.path === drive.path);
	if (idx !== -1) watchedDrives[idx] = drive;
}

// https://www.prisma.io/docs/orm/prisma-schema/overview/generators#importing-generated-model-types
export async function watchPathsInBg(
	{ drives = [] }: { drives: WatchedDrive[] } = { drives: [] }
) {
	if (drives.length === 0) {
		const prisma = (await import('$lib/prisma')).default;
		drives = await prisma.drive.findMany({ select: driveSelect });
	}

	// Populate module-level state from the initial drive list
	watchedDrives = drives;
	watchedPaths.push(...drives.map((d) => hostPath(d.path)));

	// Drive detection works by watching for the mount-point directory to appear (addDir)
	// and disappear (unlinkDir). This requires the directory to not exist when the drive is
	// absent. Do NOT use fstab or x-systemd.automount — both keep a permanent stub directory
	// at the mount point, so addDir never fires on plug-in and unlinkDir never fires on unplug.
	// Use udev rules instead (see README / manage-udev.sh).
	watcher = chokidar.watch(watchedPaths, {
		persistent: false, // We want the process to exit if this is the only thing left running
		// usePolling makes chokidar check paths via fs.stat() on an interval rather than
		// relying on OS-native watchers (inotify/FSEvents). This means deleted paths stay
		// in the watchlist and re-detection works cross-platform when a drive is unplugged
		// and plugged back in.
		usePolling: true,
		interval: 1000
	});

	// When a watched path is deleted, chokidar removes it from the watchlist — polling stops.
	// Cancel any running backup for this drive, then re-add the path (or an ancestor) so we
	// can detect when the drive is plugged back in.
	watcher.on('unlinkDir', async (deletedPath: string) => {
		if (!watchedPaths.includes(deletedPath)) return;
		console.log(`Directory removed that we're watching: ${deletedPath}`);

		// Cancel any in-progress backup — drive is gone, continuing would only error.
		const drive = watchedDrives.find((d) => hostPath(d.path) === deletedPath);
		if (drive) {
			backupAbortControllers.get(drive.path)?.abort();
			backupAbortControllers.delete(drive.path);
		}

		const parent = dirname(deletedPath);
		try {
			await access(parent);
			watcher!.add(deletedPath); // parent exists, poll the target directly
		} catch {
			const anchor = await deepestExistingAncestor(deletedPath);
			console.log(`Parent also gone, watching ancestor for re-appearance: ${anchor}`);
			anchorWatchers.set(deletedPath, anchor);
			watcher!.add(anchor);
		}
	});

	// Check for when the specific directory is added (e.g., if the user plugs in a drive that we want to back up)
	watcher.on('addDir', async (path: string) => {
		// If we were watching a temporary ancestor for this path, stop watching it now
		const anchor = anchorWatchers.get(path);
		if (anchor) {
			anchorWatchers.delete(path);
			watcher!.unwatch(anchor);
		}

		if (watchedPaths.includes(path)) {
			// path from chokidar is the resolved (prefixed) path; find the drive by its prefixed path
			const drive = watchedDrives.find((d) => hostPath(d.path) === path)!;
			console.log(`Directory added that we're watching: ${drive.path}`);

			// Respect the autoBackup flag — skip if user disabled auto-backup for this drive
			if (!drive.autoBackup) {
				console.log(`Auto-backup disabled for ${drive.path}, skipping`);
				return;
			}

			// Each backup gets its own AbortController stored in backupAbortControllers.
			// If the drive is unplugged mid-backup, the unlinkDir handler calls controller.abort(),
			// which signals execa to kill the restic process immediately (via SIGTERM).
			// restic.backup() catches the cancellation and returns without yielding an error event.
			const controller = new AbortController();
			backupAbortControllers.set(drive.path, controller);

			const restic = new Restic(
				hostPath(drive.backupPath),
				drive.resticKey,
				hostPath(drive.path),
				resticOptions(drive)
			);

			for await (const update of restic.backup(controller.signal)) {
				// Restic output: {"message_type":"status","percent_done":1,"total_files":4,"files_done":4,"total_bytes":2147483693,"bytes_done":2147483693}
				// Use the natural (un-prefixed) path as the progress key so the polling endpoint can find it
				backupProgress[drive.path] = update;
				if (update.message_type === 'status') {
					console.log(JSON.stringify(update));
				}
			}

			backupAbortControllers.delete(drive.path);

			// Prune old snapshots according to the drive's retention policy (no-op if unconfigured)
			if (backupProgress[drive.path]?.message_type === 'summary') {
				await restic.applyRetention();
			}
		}
	});
}

// For testing (won't work unless persistent is set to true)
if (import.meta.main) {
	watchPathsInBg({
		drives: [
			{
				path:          'test-data/to-backup',
				backupPath:    'test-data/restic-backup-repo',
				resticKey:     'testkey',
				autoBackup:    true,
				excludeFile:   null,
				keepSnapshots: null,
			}
		]
	});
}
