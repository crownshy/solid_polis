<script lang="ts">
	import PollCreate from '$lib/components/PollCreate.svelte';
	import { session } from '$lib/solid/auth.svelte';
</script>

<div class="min-h-screen bg-gray-50 py-8">
	{#if !session.isLoggedIn}
		<div class="max-w-2xl mx-auto p-6">
			<div class="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md">
				<p class="font-medium">Please log in to create a poll</p>
				<a href="/login" class="text-blue-600 hover:underline">Go to login</a>
			</div>
		</div>
	{:else}
		<PollCreate />
	{/if}
</div>
