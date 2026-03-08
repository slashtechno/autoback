<script lang="ts">
	import { onMount } from 'svelte';
	import { authClient } from '$lib/auth-client';
	import type { ApikeyModel } from '$lib/../generated/prisma/models/Apikey';

	let keys = $state<ApikeyModel[] | undefined>();
	let error = $state<string | null>(null);

	onMount(async () => {
		const { data, error: err } = await authClient.apiKey.list({ query: {} });
		if (err) {
			error = err.message ?? 'Unknown error';
		} else {
			keys = data?.apiKeys;
		}
	});

	let newKeyName = $state('');
	let newKeyValue = $state<string | null>(null);

	async function deleteKey(key: ApikeyModel) {
		if (!confirm(`Are you sure you want to delete the API key "${key.name}"? This action cannot be undone.`)) return;
		const { error: err } = await authClient.apiKey.delete({ keyId: key.id });
		if (err) {
			alert(`Error deleting API key: ${err.message ?? 'Unknown error'}`);
		} else {
			keys = keys?.filter((k) => k.id !== key.id);
		}
	}

	async function createKey() {
		const { data, error: err } = await authClient.apiKey.create({ name: newKeyName });
		if (err) {
			error = err.message ?? 'Unknown error';
		} else if (data) {
			keys = [...(keys ?? []), data];
			newKeyValue = data.key;
			newKeyName = '';
		}
	}
</script>

<h1>API Keys</h1>
<div>
	{#if error}
		<p class="text-red-500 dark:text-red-400">Error fetching API keys: {error}</p>
	{:else if keys === undefined}
		<p>Loading...</p>
	{:else if keys.length}
		<ul>
			{#each keys as key (key.id)}
				<li>
					<strong>{key.name}</strong> - Created at: {new Date(key.createdAt).toLocaleString()}
                    <button
                        class="ml-4 rounded bg-red-500 px-2 py-1 text-white"
                        onclick={() => deleteKey(key)}
                    >Delete</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p>No API keys found.</p>
	{/if}
</div>
<div>
	<input
    type="text"
    placeholder="New API key name"
    bind:value={newKeyName}
    class="mr-2 rounded border p-2"
	/>
	<button onclick={createKey} class="rounded bg-blue-500 px-4 py-2 text-white"
		>Create API Key</button
	>
	{#if newKeyValue}
		<p class="italic underline">
			Newly Created API Key (note: this value is only shown once, so copy it now!)
		</p>
		<pre class="rounded bg-gray-100 p-2 dark:bg-gray-800">{newKeyValue}</pre>
	{/if}
</div>
