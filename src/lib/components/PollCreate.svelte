<script lang="ts">
	import { session } from '$lib/solid/auth.svelte';
	import { PolisStorage } from '$lib/solid/polis-storage';
	import { goto } from '$app/navigation';

	let title = $state('');
	let description = $state('');
	let creating = $state(false);
	let error = $state('');

	async function createPoll() {
		if (!session.isLoggedIn || !session.webId) {
			error = 'You must be logged in to create a poll';
			return;
		}

		if (!title.trim()) {
			error = 'Please enter a poll title';
			return;
		}

		creating = true;
		error = '';

		try {
			// Use the authenticated fetch from the session
			const authenticatedFetch = session.getFetch();
			console.log('Using authenticated fetch for poll creation');
			const storage = new PolisStorage(authenticatedFetch);
			const poll = await storage.createPoll(session.webId, {
				title: title.trim(),
				description: description.trim(),
				creator: session.webId
			});

			goto(`/polls/${poll.id}`);
		} catch (err) {
			console.error('Error creating poll:', err);
			error = `Failed to create poll: ${err instanceof Error ? err.message : 'Unknown error'}`;
			creating = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto p-6">
	<h2 class="text-2xl font-bold mb-4">Create New Poll</h2>

	<form onsubmit={(e) => { e.preventDefault(); createPoll(); }} class="space-y-4">
		<div>
			<label for="title" class="block text-sm font-medium mb-1">
				Poll Title <span class="text-red-500">*</span>
			</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				placeholder="Enter poll title"
				class="w-full px-3 py-2 border rounded-md"
				required
			/>
		</div>

		<div>
			<label for="description" class="block text-sm font-medium mb-1">
				Description
			</label>
			<textarea
				id="description"
				bind:value={description}
				placeholder="What is this poll about?"
				class="w-full px-3 py-2 border rounded-md"
				rows="4"
			></textarea>
		</div>

		{#if error}
			<div class="bg-red-50 text-red-700 p-3 rounded-md">
				{error}
			</div>
		{/if}

		<button
			type="submit"
			disabled={creating || !session.isLoggedIn}
			class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
		>
			{creating ? 'Creating...' : 'Create Poll'}
		</button>
	</form>
</div>
