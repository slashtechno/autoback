<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import CheckLogin from '$lib/components/CheckLogin.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="flex h-screen flex-col">
	<div class="grow">
		<!-- Header -->
		<header class="flex justify-center">
			<a href="/"><h1 class="prose prose-xl">Autoback</h1></a>
		</header>
		{@render children()}
	</div>
	<footer class="flex justify-center">
		<CheckLogin />
	</footer>
</div>
