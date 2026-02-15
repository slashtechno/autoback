<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Header -->
<header class="flex justify-center">
	<a href="/"><h1 class="prose prose-xl">Autoback</h1></a>
</header>

{@render children()}