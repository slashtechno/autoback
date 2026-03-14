import { access } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Returns true if `path` is accessible, OR if only the leaf directory is missing
 * (i.e. the parent exists — new restic repo case where restic creates the leaf).
 * Returns false only when the parent is also missing (backup drive unmounted).
 */
export async function isPathReachable(path: string): Promise<boolean> {
	try {
		await access(path);
		return true;
	} catch {
		try {
			await access(dirname(path));
			return true; // parent exists → new repo case, proceed
		} catch {
			return false; // parent also missing → drive is gone
		}
	}
}
