export interface DiffGroup {
	dir: string;
	added: number;
	removed: number;
	modified: number;
	files: Array<{ sign: string; name: string }>;
}

// Parse `restic diff` stdout into groups keyed by the first path segment.
// Lines look like: `+    /some/path/file.txt` or `M    /dir/file`
export function parseDiff(stdout: string): DiffGroup[] {
	const map = new Map<string, DiffGroup>();

	for (const line of stdout.split('\n')) {
		const m = line.match(/^([+\-M])\s+(.+)$/);
		if (!m) continue;
		const [, sign, path] = m;

		// Group by first path segment: `/home/user/file` → dir `/home/`, name `user/file`
		const sep = path.indexOf('/', 1);
		const dir  = sep !== -1 ? path.slice(0, sep + 1) : '/';
		const name = sep !== -1 ? path.slice(sep + 1)    : path.slice(1);

		let g = map.get(dir);
		if (!g) { g = { dir, added: 0, removed: 0, modified: 0, files: [] }; map.set(dir, g); }

		if      (sign === '+') g.added++;
		else if (sign === '-') g.removed++;
		else                   g.modified++;

		g.files.push({ sign, name });
	}

	// Busiest directories first.
	return [...map.values()].sort(
		(a, b) => (b.added + b.removed + b.modified) - (a.added + a.removed + a.modified)
	);
}
