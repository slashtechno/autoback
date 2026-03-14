import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import prisma from '$lib/prisma';
import Restic from '$lib/restic';
import { hostPath } from '$lib/server/host-path';

// Stream a specific restic snapshot as a .tar.gz download — no temp files.
// restic dump outputs a TAR archive to stdout; we pipe it through gzip on the fly.
// The snapshotId path segment accepts any valid restic snapshot ID (full or short).
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const drive = await prisma.drive.findUnique({ where: { id: params.id } });
	if (!drive) error(404, 'Drive not found');

	// Sanitize snapshotId before embedding in a response header to prevent header injection
	const safeId = params.snapshotId.replace(/[^a-zA-Z0-9_-]/g, '_');

	const proc = new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).dump(params.snapshotId);
	const gz = createGzip();

	if (!proc.stdout) error(500, 'Failed to start restic dump process');

	// Propagate subprocess errors into the gzip stream so the client connection is closed cleanly
	proc.on('error', (err) => gz.destroy(err));
	proc.stdout.pipe(gz);

	// Readable.toWeb() bridges Node's stream API to the Web Streams API that Response expects.
	return new Response(Readable.toWeb(gz) as ReadableStream, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': `attachment; filename="backup-${safeId}.tar.gz"`
		}
	});
};
