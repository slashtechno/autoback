import { execa } from 'execa';

export default class Restic {
	repoPath: string;
	password: string;
	targetPath: string;

	constructor(repoPath: string, password: string, targetPath: string) {
		this.repoPath = repoPath;
		this.password = password;
		this.targetPath = targetPath;
	}

    // This is private since backup() will call it
	private initializeRepoIfNeeded = async () => {
		try {
			await execa('restic', ['snapshots', '-r', this.repoPath], {
				env: { RESTIC_PASSWORD: this.password }
			});
		} catch {
			await execa('restic', ['init', '-r', this.repoPath], {
				env: { RESTIC_PASSWORD: this.password }
			});
			console.log(`Initialized: ${this.repoPath}`);
		}
	};

    private unlockRepo = async () => {
        try {
            await execa('restic', ['unlock', '-r', this.repoPath], {
                env: { RESTIC_PASSWORD: this.password }
            });
            console.log(`Unlocked repo: ${this.repoPath}`);
        } catch (error) {
            console.error(`Error unlocking repo: ${error}`);
        }
    };

    async *backup(this: Restic) {
        // Ensure the repo is initialized before trying to back up
        await this.initializeRepoIfNeeded();
        // First, unlock the repo to clear any locks that might be present from previous runs that didn't exit cleanly
        await this.unlockRepo();

        try {
            const execaPromise = execa('restic', ['backup', this.targetPath, '-r', this.repoPath, '--json'], {
                env: { RESTIC_PASSWORD: this.password }
            });
            // https://github.com/sindresorhus/execa/blob/f3a2e8481a1e9138de3895827895c834078b9456/docs/lines.md#progressive-splitting
            for await (const line of execaPromise){
                yield line;
            }
            console.log(`Backup successful for ${this.targetPath}: ${this.repoPath}`);
        } catch (error) {
            console.error(`Error during backup of ${this.targetPath}: ${error}`);
        }
    };
}
