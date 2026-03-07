import { execa } from 'execa';

export interface ResticSnapshot {
	id: string;       // full SHA
	short_id: string; // 8-char abbreviation shown in the UI
	time: string;     // ISO timestamp of when the snapshot was taken
	paths: string[];  // source paths included in the snapshot
}

// Discriminated union of every JSON message type restic emits during `backup --json`.
// The `message_type` field lets callers narrow to the exact shape without casting.
export type ResticEvent =
	| { message_type: 'status';  percent_done: number; total_files: number; files_done: number; total_bytes: number; bytes_done: number }
	| { message_type: 'summary'; files_new: number; files_changed: number; data_added: number; [key: string]: unknown }
	| { message_type: 'error';   error: string };

export interface ResticOptions {
	// Path to a restic-format exclude pattern file (one glob per line).
	excludeFile?:   string;
	// Keep this many most-recent snapshots; older ones are pruned after each successful backup.
	keepSnapshots?: number;
}

export default class Restic {
	repoPath:   string;
	password:   string;
	sourcePath: string; // the path being backed up (used by backup() and dump())
	options:    ResticOptions;

	constructor(repoPath: string, password: string, sourcePath: string, options: ResticOptions = {}) {
		this.repoPath   = repoPath;
		this.password   = password;
		this.sourcePath = sourcePath;
		this.options    = options;
	}

	// Shared helpers — centralising these prevents typos across every execa call.
	private get env()       { return { RESTIC_PASSWORD: this.password }; }
	private get repoFlags() { return ['-r', this.repoPath] as const; }

	// Run `restic snapshots` and return the parsed list. Returns [] if the repo doesn't exist yet.
	async snapshots(): Promise<ResticSnapshot[]> {
		const { stdout } = await execa('restic', ['snapshots', ...this.repoFlags, '--json'], { env: this.env });
		return JSON.parse(stdout);
	}

	// Remove a single snapshot by ID and prune unreferenced data packs in one step.
	async forget(snapshotId: string): Promise<void> {
		await execa('restic', ['forget', snapshotId, '--prune', ...this.repoFlags], { env: this.env });
	}

	// Keep only the N most recent snapshots, pruning the rest.
	// No-op if keepSnapshots is not configured — safe to call unconditionally after every backup.
	async applyRetention(): Promise<void> {
		const { keepSnapshots } = this.options;
		if (!keepSnapshots) return;

		await execa(
			'restic',
			['forget', '--prune', '--keep-last', String(keepSnapshots), ...this.repoFlags],
			{ env: this.env }
		);
		console.log(`Retention applied: kept last ${keepSnapshots} snapshots in ${this.repoPath}`);
	}

	// Run `restic check` to verify repo integrity. Returns the stdout summary.
	async check(): Promise<string> {
		const { stdout } = await execa('restic', ['check', ...this.repoFlags], { env: this.env });
		return stdout;
	}

	// Restore a snapshot. `targetPath` is used as a filesystem root by restic —
	// files are placed at `targetPath/original/absolute/path`. Use `/` to restore in-place.
	async restore(snapshotId: string, targetPath: string): Promise<void> {
		await execa('restic', ['restore', snapshotId, '--target', targetPath, ...this.repoFlags], { env: this.env });
	}

	// Spawn `restic dump` with stdout piped, for streaming a TAR archive to the browser.
	// Caller is responsible for reading/piping proc.stdout.
	dump() {
		return execa(
			'restic',
			['dump', 'latest', this.sourcePath, '--archive', 'tar', ...this.repoFlags],
			{ env: this.env, stdout: 'pipe' }
		);
	}

	// Run `restic backup` as an async generator, yielding each JSON progress line as it arrives.
	// Pass an AbortSignal to cancel mid-backup (e.g. when the source drive is unplugged) —
	// restic is killed immediately and no error event is yielded, since cancellation is intentional.
	async *backup(signal?: AbortSignal): AsyncGenerator<ResticEvent> {
		await this.initializeRepoIfNeeded();
		await this.unlockRepo();
		try {
			const flags = [
				'backup', this.sourcePath, ...this.repoFlags, '--json',
				...(this.options.excludeFile ? ['--exclude-file', this.options.excludeFile] : []),
			];
			const proc = execa('restic', flags, { env: this.env, cancelSignal: signal });

			for await (const line of proc) {
				yield JSON.parse(line) as ResticEvent;
			}
			console.log(`Backup complete: ${this.sourcePath} → ${this.repoPath}`);
		} catch (err: unknown) {
			// `isCanceled` is set by execa when the cancelSignal fires — clean exit, nothing to surface.
			if ((err as { isCanceled?: boolean }).isCanceled) return;
			const message = err instanceof Error ? err.message : String(err);
			console.error(`Backup error for ${this.sourcePath}: ${message}`);
			yield { message_type: 'error', error: message };
		}
	}

	// Check if the repo exists by running `restic snapshots`; init it if that fails.
	private initializeRepoIfNeeded = async () => {
		try {
			await execa('restic', ['snapshots', ...this.repoFlags], { env: this.env });
		} catch {
			await execa('restic', ['init', ...this.repoFlags], { env: this.env });
			console.log(`Initialized repo: ${this.repoPath}`);
		}
	};

	private unlockRepo = async () => {
		try {
			await execa('restic', ['unlock', ...this.repoFlags], { env: this.env });
		} catch (error) {
			console.error(`Error unlocking repo: ${error}`);
		}
	};
}
