import chokidar from 'chokidar';
import { Prisma } from '$lib/../generated/prisma/client';
// To allow us to run watcher.ts directly, we can't import Prisma since it needs to load env vars via Vite env functions
import Restic from './restic';
import { backupProgress } from './server/backup-progress';

// Satisifes is basically saying "Ensure this object is assignable to Prisma.DriveSelect, but keep its exact literal type."
const driveSelect = {
	path: true,
	backupPath: true,
	resticKey: true
} satisfies Prisma.DriveSelect;

// https://www.prisma.io/docs/orm/prisma-schema/overview/generators#importing-generated-model-types
export async function watchPathsInBg(
	{ drives = [] }: { drives: Prisma.DriveGetPayload<{ select: typeof driveSelect }>[] } = { drives: [] }
) {
	if (drives.length === 0) {
		const prisma = (await import('$lib/prisma')).default;
		drives = await prisma.drive.findMany({
			select: {
				path: true,
				backupPath: true,
				resticKey: true
			}
		});
	}

	const pathsToWatch = drives.map((drive) => drive.path);
	const watcher = chokidar.watch(pathsToWatch, {
		persistent: false, // We want the process to exit if this is the only thing left running
		// usePolling makes chokidar check paths via fs.stat() on an interval rather than
		// relying on OS-native watchers (inotify/FSEvents). This means deleted paths stay
		// in the watchlist and re-detection works cross-platform when a drive is unplugged
		// and plugged back in.
		usePolling: true,
		interval: 1000,
	});

	// When a watched path is deleted, chokidar removes it from the watchlist — polling stops.
	// Re-add it so polling resumes. With usePolling, fs.watchFile() keeps checking even if
	// the path (or its parent) doesn't exist yet, so it will detect when the drive comes back.
	watcher.on('unlinkDir', (path) => {
		if (pathsToWatch.includes(path)) {
			console.log(`Directory removed that we're watching: ${path}, re-registering for polling`);
			watcher.add(path);
		}
	});

	// Check for when the specific directory is added (e.g., if the user plugs in a drive that we want to back up)
	watcher.on('addDir', async (path) => {
		if (pathsToWatch.includes(path)) {
			console.log(`Directory added that we're watching: ${path}`);
			// pathsToWatch is built from drives so it's fine to use !
			const drive = drives.find((d) => d.path === path)!;
			const resticInstance = new Restic(drive.backupPath, drive.resticKey, drive.path);
			for await (const update of resticInstance.backup()) {
				// Restic output: {"message_type":"status","percent_done":1,"total_files":4,"files_done":4,"total_bytes":2147483693,"bytes_done":2147483693}
				backupProgress[path] = update;
				if (update.message_type === 'status') {
					console.log(`Backup progress for ${path}: ${update.percent_done}%`);
				}
			}
		}
	});
}

// For testing (won't work unless persistent is set to true)
if (import.meta.main) {
	// watchPathsInBg({ pathsToWatch: ['test-data/to-backup'] });
	watchPathsInBg({ drives: [
		{
			path: 'test-data/to-backup',
			backupPath: 'test-data/restic-backup-repo',
			resticKey: 'testkey'
		}
	] });
} else {
}
