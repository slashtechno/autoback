import { execa } from 'execa';

export interface ResticSnapshot {
	id: string;       // full SHA
	short_id: string; // 8-char abbreviation shown in the UI
	time: string;     // ISO timestamp of when the snapshot was taken
	paths: string[];  // source paths included in the snapshot
}

export default class Restic {
	repoPath: string;
	password: string;
	sourcePath: string; // the path being backed up (used by backup() and dump())

	constructor(repoPath: string, password: string, sourcePath: string) {
		this.repoPath = repoPath;
		this.password = password;
		this.sourcePath = sourcePath;
	}

	// Run `restic snapshots` and return the parsed list. Returns [] if the repo doesn't exist yet.
	async snapshots(): Promise<ResticSnapshot[]> {
		const { stdout } = await execa('restic', ['snapshots', '-r', this.repoPath, '--json'], {
			env: { RESTIC_PASSWORD: this.password }
		});
		return JSON.parse(stdout);
	}

	// Remove a snapshot by ID and prune unreferenced data packs in one step.
	async forget(snapshotId: string): Promise<void> {
		await execa('restic', ['forget', snapshotId, '--prune', '-r', this.repoPath], {
			env: { RESTIC_PASSWORD: this.password }
		});
	}

	// Restore a snapshot. `targetPath` is used as a filesystem root by restic —
	// files are placed at `targetPath/original/absolute/path`. Use `/` to restore in-place.
	async restore(snapshotId: string, targetPath: string): Promise<void> {
		await execa('restic', ['restore', snapshotId, '--target', targetPath, '-r', this.repoPath], {
			env: { RESTIC_PASSWORD: this.password }
		});
	}

	// Spawn `restic dump` with stdout piped, for streaming a TAR archive to the browser.
	// Caller is responsible for reading/piping proc.stdout.
	dump() {
		return execa(
			'restic',
			['dump', 'latest', this.sourcePath, '--archive', 'tar', '-r', this.repoPath],
			{ env: { RESTIC_PASSWORD: this.password }, stdout: 'pipe' }
		);
	}

	// Run `restic backup` as an async generator, yielding each JSON progress line as it arrives.
	async *backup(this: Restic) {
		await this.initializeRepoIfNeeded();
		await this.unlockRepo();
		try {
			const proc = execa('restic', ['backup', this.sourcePath, '-r', this.repoPath, '--json'], {
				env: { RESTIC_PASSWORD: this.password }
			});
			for await (const line of proc) {
				yield JSON.parse(line);
			}
			console.log(`Backup complete: ${this.sourcePath} → ${this.repoPath}`);
		} catch (error) {
			console.error(`Backup error for ${this.sourcePath}: ${error}`);
		}
	}

	// Check if the repo exists by running `restic snapshots`; init it if that fails.
	private initializeRepoIfNeeded = async () => {
		try {
			await execa('restic', ['snapshots', '-r', this.repoPath], {
				env: { RESTIC_PASSWORD: this.password }
			});
		} catch {
			await execa('restic', ['init', '-r', this.repoPath], {
				env: { RESTIC_PASSWORD: this.password }
			});
			console.log(`Initialized repo: ${this.repoPath}`);
		}
	};

	private unlockRepo = async () => {
		try {
			await execa('restic', ['unlock', '-r', this.repoPath], {
				env: { RESTIC_PASSWORD: this.password }
			});
		} catch (error) {
			console.error(`Error unlocking repo: ${error}`);
		}
	};
}
