<script lang="ts">
	import type { DiffGroup } from '$lib/diff';

	let { groups }: { groups: DiffGroup[] } = $props();

	// Directories with more than this many changes are collapsed by default.
	const THRESHOLD = 20;

	let expanded: Record<string, boolean> = $state({});
</script>

<div class="font-mono text-xs space-y-0.5">
	{#each groups as g (g.dir)}
		{@const total = g.added + g.removed + g.modified}
		{@const big   = total > THRESHOLD}
		<div>
			<!-- Directory row — clickable to expand when it has many changes -->
			<div
				class="flex gap-2 items-center {big ? 'cursor-pointer select-none' : ''}"
				onclick={() => { if (big) expanded[g.dir] = !expanded[g.dir]; }}
				role={big ? 'button' : undefined}
				tabindex={big ? 0 : undefined}
				aria-expanded={big ? (expanded[g.dir] ?? false) : undefined}
				onkeydown={(e) => { if (big && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); expanded[g.dir] = !expanded[g.dir]; } }}
			>
				<span class="text-gray-500 dark:text-gray-400">{g.dir}</span>
				{#if g.added}  <span class="text-green-600 dark:text-green-400">+{g.added}</span>{/if}
				{#if g.removed}<span class="text-red-500  dark:text-red-400"  >-{g.removed}</span>{/if}
				{#if g.modified}<span class="text-yellow-600 dark:text-yellow-400">~{g.modified}</span>{/if}
				{#if big}<span class="text-gray-400 ml-1">{expanded[g.dir] ? '▾' : '▸'} {total} files</span>{/if}
			</div>

			<!-- File list — always shown for small groups, toggled for large ones -->
			{#if !big || expanded[g.dir]}
				<div class="pl-3">
					{#each g.files as f}
						<div class="{f.sign === '+' ? 'text-green-600 dark:text-green-400' : f.sign === '-' ? 'text-red-500 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}">{f.sign}  {f.name}</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>
