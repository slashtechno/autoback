<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	let { form, data }: PageProps = $props();

	// Progress per drive id — undefined means no backup running yet
	let progress: Record<string, { percent: number; status: string }> = $state({});

	onMount(() => {
		for (const drive of data.drives ?? []) {
			// Poll the endpoint every second for this drive's current backup progress
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
					clearInterval(interval); // backup done, stop polling
				}
			}, 1000);
		}
	});
</script>

<div class="flex flex-col items-center justify-center gap-4">
	<h1 class="prose prose-xl">Drives</h1>
	<p>Here you can manage your drives. You can create new drives and view existing ones.</p>
	<section>
		<form method="POST" use:enhance action="?/create">
			<label>
				Path
				<input type="text" name="path" required />
			</label>
			<label>
				Backup Path
				<input type="text" name="backupPath" required />
			</label>
			<label>
				Restic Key
				<input type="text" name="resticKey" required />
			</label>
			<button>Create Drive</button>
		</form>
	</section>
	<section>
		{#if data?.drives}
			<h2 class="prose prose-lg">Existing Drives</h2>
			<ul>
				{#each data.drives as drive}
					<li>
						<strong>Path:</strong> {drive.path} <br />
						<strong>Backup Path:</strong> {drive.backupPath} <br />
						{#if progress[drive.id]}
							<span>{progress[drive.id]?.percent}% — {progress[drive.id]?.status}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p>No drives found.</p>
		{/if}
	</section>
</div>
