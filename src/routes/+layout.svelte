<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import CheckLogin from '$lib/components/CheckLogin.svelte';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="max-w-2xl mx-auto px-5">
	<header class="py-2.5 border-b border-gray-200 dark:border-gray-700 mb-6">
		<a href="/"><strong>Autoback</strong></a>
	</header>

	{@render children()}

	<footer class="mt-10 py-2.5 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
		<CheckLogin />
	</footer>
</div>
