import chokidar from 'chokidar';
// To allow us to run watcher.ts directly, we can't import Prisma since it needs to load env vars via Vite env functions
export async function watchPathsInBg({
	pathsToWatch = []
}: {
	pathsToWatch?: string[];
} = {}) {
    if (pathsToWatch.length === 0) {
        const prisma = (await import('$lib/prisma')).default; 
		const drives = await prisma.drive.findMany({
			select: {
				path: true,
				backupPath: true,
				resticKey: true
			}
		});
		pathsToWatch = drives.map((drive) => {
			return drive.path;
		});
	}
	const watcher = chokidar.watch(pathsToWatch, {
		persistent: true,
	});

    // Debugging
    watcher.on('all', (event, path) => {
        console.log(`${event} detected at path: ${path}`);
    });

    /* Based on some testing, assuming we're watching `/tmp/autoback-test`:
    - Creating /tmp/autoback-test/ when it doesn't exist triggers `addDir detected at path: /tmp/autoback-test`
    - Removing /tmp/autoback-test/ when it exists triggers `unlinkDir detected at path: /tmp/autoback-test`
    */
}

// For testing
if (import.meta.main) {
	watchPathsInBg({ pathsToWatch: ['/tmp/autoback-test'] });
} else {
}