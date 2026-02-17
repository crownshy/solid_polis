<script lang="ts">
	import type { Poll } from '$lib/types/polis';

	interface Props {
		polls: Poll[];
		title: string;
		emptyMessage?: string;
	}

	let { polls, title, emptyMessage = 'No polls yet' }: Props = $props();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="mb-8">
	<h2 class="text-2xl font-semibold mb-4">{title}</h2>

	{#if polls.length === 0}
		<p class="text-gray-500 italic">{emptyMessage}</p>
	{:else}
		<div class="space-y-3">
			{#each polls as poll (poll.id)}
				<a
					href="/polls/{poll.id}"
					class="block p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
				>
					<h3 class="font-semibold text-lg mb-1">{poll.title}</h3>
					{#if poll.description}
						<p class="text-gray-600 text-sm mb-2 line-clamp-2">{poll.description}</p>
					{/if}
					<p class="text-xs text-gray-500">Created {formatDate(poll.created)}</p>
				</a>
			{/each}
		</div>
	{/if}
</div>
