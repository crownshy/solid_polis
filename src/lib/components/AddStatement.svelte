<script lang="ts">
	interface Props {
		onAdd: (text: string) => Promise<void>;
		adding: boolean;
	}

	let { onAdd, adding }: Props = $props();

	let text = $state('');
	let showForm = $state(false);

	async function handleSubmit() {
		if (!text.trim()) return;

		await onAdd(text.trim());
		text = '';
		showForm = false;
	}
</script>

{#if !showForm}
	<button
		onclick={() => (showForm = true)}
		class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
	>
		Add Your Statement
	</button>
{:else}
	<div class="border rounded-lg p-4 bg-white shadow-sm">
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-3">
			<div>
				<label for="statement" class="block text-sm font-medium mb-1">
					Your Statement
				</label>
				<textarea
					id="statement"
					bind:value={text}
					placeholder="Share your perspective..."
					class="w-full px-3 py-2 border rounded-md"
					rows="3"
					required
					></textarea>
			</div>

			<div class="flex gap-2">
				<button
					type="submit"
					disabled={adding || !text.trim()}
					class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
				>
					{adding ? 'Adding...' : 'Submit Statement'}
				</button>
				<button
					type="button"
					onclick={() => { showForm = false; text = ''; }}
					disabled={adding}
					class="px-4 py-2 border rounded-md hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</form>
	</div>
{/if}
