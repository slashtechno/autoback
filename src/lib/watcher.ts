import chokidar from 'chokidar';
import { Prisma } from '$lib/../generated/prisma/client';
// To allow us to run watcher.ts directly, we can't import Prisma since it needs to load env vars via Vite env functions

// Satisifes is basically saying “Ensure this object is assignable to Prisma.DriveSelect, but keep its exact literal type.”
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

	const pathsToWatch = drives.map((drive) => {
		return drive.path;
	});
	const watcher = chokidar.watch(pathsToWatch, {
		persistent: true
	});

	// Debugging
	/* Based on some testing, assuming we're watching `/tmp/autoback-test`:
	- Creating /tmp/autoback-test/ when it doesn't exist triggers `addDir detected at path: /tmp/autoback-test`
	- Removing /tmp/autoback-test/ when it exists triggers `unlinkDir detected at path: /tmp/autoback-test`
	*/
	// watcher.on('all', (event, path) => {
	//     console.log(`${event} detected at path: ${path}`);
	// });

	// Check for when the specific directory is added (e.g., if the user plugs in a drive that we want to back up)
	watcher.on('addDir', (path) => {
		if (pathsToWatch.includes(path)) {
			console.log(`Directory added that we're watching: ${path}`);
		}
	});
}

// For testing
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
