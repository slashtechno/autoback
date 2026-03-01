import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import prisma from '$lib/prisma';
import Restic from '$lib/restic';
import { hostPath } from '$lib/server/host-path';

// Stream the latest restic snapshot as a .tar.gz download — no temp files.
// restic dump outputs a TAR archive to stdout; we pipe it through gzip on the fly.
export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const drive = await prisma.drive.findUnique({ where: { id: params.id } });
	if (!drive) error(404, 'Drive not found');

	const proc = new Restic(hostPath(drive.backupPath), drive.resticKey, hostPath(drive.path)).dump();
	const gz = createGzip();
	proc.stdout!.pipe(gz);

	// Readable.toWeb() bridges Node's stream API to the Web Streams API that Response expects.
	return new Response(Readable.toWeb(gz) as ReadableStream, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': 'attachment; filename="backup.tar.gz"'
		}
	});
};
