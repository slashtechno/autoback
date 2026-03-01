<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	const session = authClient.useSession();

	// Docs: https://www.better-auth.com/docs/concepts/client#hooks (refetch is documented here)
	// and https://www.better-auth.com/docs/integrations/svelte-kit (server-action auth + SvelteKit integration details)
	afterNavigate(async () => {
		await session.get().refetch();
	});

	async function handleSignOut() {
		await authClient.signOut();
		await session.get().refetch();
		await goto('/');
	}
</script>

<div>
	{#if $session.data}
		<div class="flex flex-col justify-center">
			<p class="prose">
				Logged in as <span class="font-mono italic"> {$session.data.user.name}</span>
			</p>
			<button onclick={handleSignOut}> Sign Out </button>
		</div>
	{:else if page.url.pathname !== '/login'}
		<button onclick={() => goto('/login')} class=""> Login </button>
	{/if}
</div>
