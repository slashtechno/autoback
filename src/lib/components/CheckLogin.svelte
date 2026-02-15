<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	const session = authClient.useSession();

	function handleSignOut() {
		authClient.signOut();
		goto('/');
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
	{:else}
		<button onclick={() => goto('/login')} class=""> Login </button>
	{/if}
</div>
