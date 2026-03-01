<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { form, data }: PageProps = $props();
	let progress: Record<string, { percent: number; status: string }> = $state({});
	let deleteDialogs: Record<string, HTMLDialogElement> = $state({});

	// Poll backup progress once per second. We use polling rather than SSE/websockets because
	// the endpoint just reads a server-side in-memory object that the watcher writes to.
	onMount(() => {
		for (const drive of data.drives ?? []) {
			const interval = setInterval(async () => {
				const update = await fetch(`/drives/${drive.id}/backup`).then((r) => r.json());
				if (!update) return;
				if (update.message_type === 'status') {
					progress[drive.id] = {
						percent: Math.round(update.percent_done * 100),
						status: `${update.files_done}/${update.total_files} files`
					};
				} else if (update.message_type === 'summary') {
					progress[drive.id] = { percent: 100, status: 'Complete' };
					clearInterval(interval);
				}
			}, 1000);
		}
	});

	// Warn the user about restic's target-as-filesystem-root behavior before restoring.
	function confirmRestore(e: SubmitEvent, shortId: string) {
		const t = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>('[name=targetPath]')?.value;
		const ok = confirm(
			`Restore ${shortId} to "${t}"?\n\n` +
			`Restic uses this as a filesystem root — files land at:\n` +
			`  ${t}/original/absolute/path\n\n` +
			`Use / to restore in-place to original locations.`
		);
		if (!ok) e.preventDefault();
	}
</script>

<h2 class="mb-1">Drives</h2>
<p class="text-gray-500 dark:text-gray-400 mb-5">Watched drives and their restic backups.</p>

{#if form?.message}
	<p class="text-red-500 dark:text-red-400">{form.message}</p>
{/if}

<!-- Add Drive -->
<form method="POST" use:enhance action="?/create" class="mb-7">
	<div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
		<label>
			Source path
			<input type="text" name="path" placeholder="/media/usb" required />
		</label>
		<label>
			Backup repository
			<input type="text" name="backupPath" placeholder="/backups/repo" required />
		</label>
		<label>
			Restic password
			<input type="password" name="resticKey" required />
		</label>
		<button type="submit">Add</button>
	</div>
</form>

<hr class="border-gray-200 dark:border-gray-700 my-4" />

<!-- Drive list -->
{#if data.drives?.length}
	{#each data.drives as drive (drive.id)}
		<div class="py-2.5 border-b border-gray-200 dark:border-gray-700">
			<!-- source → backup path -->
			<div class="mb-1">
				<code class="text-[13px]">{drive.path}</code>
				<span class="text-gray-400 dark:text-gray-600 mx-1.5">→</span>
				<code class="text-xs text-gray-400 dark:text-gray-500">{drive.backupPath}</code>
			</div>

			<!-- Progress bar (only visible during an active backup) -->
			{#if progress[drive.id]}
				<div class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
					{progress[drive.id].percent}% — {progress[drive.id].status}
				</div>
				<progress
					value={progress[drive.id].percent}
					max="100"
					class="block w-full h-0.5 accent-gray-500 dark:accent-gray-400 my-1"
				></progress>
			{/if}

			<!-- Actions -->
			<div class="flex gap-1.5 flex-wrap items-center mt-1.5">
				<form method="POST" use:enhance action="?/backup">
					<input type="hidden" name="id" value={drive.id} />
					<button type="submit">Backup now</button>
				</form>

				<a href="/drives/{drive.id}/snapshot">↓ Download</a>

				<form method="POST" use:enhance action="?/toggleAutoBackup">
					<input type="hidden" name="id" value={drive.id} />
					<label class="text-gray-600 dark:text-gray-300">
						<input
							type="checkbox"
							name="autoBackup"
							value="on"
							checked={drive.autoBackup}
							onchange={(e) => (e.currentTarget as HTMLInputElement).form?.requestSubmit()}
						/>
						Auto-backup
					</label>
				</form>

				<button
					type="button"
					class="ml-auto text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600"
					onclick={() => deleteDialogs[drive.id]?.showModal()}
				>Delete</button>
			</div>

			<!-- Snapshot list -->
			{#if data.snapshots?.[drive.id]?.length}
				<details class="mt-2">
					<summary class="text-sm text-gray-500 dark:text-gray-400">{data.snapshots[drive.id].length} snapshot{data.snapshots[drive.id].length !== 1 ? 's' : ''}</summary>
					<div class="mt-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
						{#each data.snapshots[drive.id] as snap (snap.id)}
							<div class="flex gap-2 items-baseline py-1 border-b border-gray-100 dark:border-gray-800 flex-wrap">
								<code class="text-xs">{snap.short_id}</code>
								<span class="text-xs text-gray-400 dark:text-gray-500">{new Date(snap.time).toLocaleString()}</span>

								<form
									method="POST"
									use:enhance
									action="?/deleteSnapshot"
									class="inline"
									onsubmit={(e) => { if (!confirm(`Delete snapshot ${snap.short_id}?`)) e.preventDefault(); }}
								>
									<input type="hidden" name="driveId" value={drive.id} />
									<input type="hidden" name="snapshotId" value={snap.id} />
									<button type="submit" class="text-xs py-px px-2">Delete</button>
								</form>

								<form
									method="POST"
									use:enhance
									action="?/restore"
									class="contents"
									onsubmit={(e) => confirmRestore(e, snap.short_id)}
								>
									<input type="hidden" name="driveId" value={drive.id} />
									<input type="hidden" name="snapshotId" value={snap.id} />
									<input
										type="text"
										name="targetPath"
										placeholder="/ (in-place) or /tmp/restore"
										title="Restic treats this as a filesystem root. Use / to restore files to their original paths."
										class="w-[220px] text-xs py-px px-1.5"
										required
									/>
									<button type="submit" class="text-xs py-px px-2">Restore</button>
								</form>
							</div>
						{/each}
					</div>
				</details>
			{:else}
				<p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">No snapshots.</p>
			{/if}
		</div>

		<!-- Delete confirmation dialog -->
		<dialog
			bind:this={deleteDialogs[drive.id]}
			class="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 p-5 max-w-sm w-full"
		>
			<p class="mb-3 font-semibold">Delete "{drive.path}"?</p>
			<form method="POST" use:enhance action="?/delete">
				<input type="hidden" name="id" value={drive.id} />
				<label class="mb-4">
					<input type="checkbox" name="deleteRepo" />
					Also delete backup repository from disk
				</label>
				<div class="flex gap-2 justify-end">
					<button type="button" onclick={() => deleteDialogs[drive.id]?.close()}>Cancel</button>
					<button type="submit">Delete</button>
				</div>
			</form>
		</dialog>
	{/each}
{:else}
	<p class="text-gray-400 dark:text-gray-500">No drives added yet.</p>
{/if}
