<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';
	let { form, data }: PageProps = $props();
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
                    </li>
                {/each}
            </ul>
        {:else}
            <p>No drives found.</p>
        {/if}
    </section>
</div>
