<script lang="ts">
	import { session } from '$lib/solid/auth.svelte';
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-4xl mx-auto px-6 py-12">
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold mb-4">Solid Polis</h1>
			<p class="text-xl text-gray-600 mb-2">
				Privacy-Preserving Collaborative Polling
			</p>
			<p class="text-gray-500">
				Built on the Solid Protocol - Your data stays in your pod
			</p>
		</div>

		{#if session.isLoggedIn}
			<div class="bg-white rounded-lg shadow-md p-8 mb-8">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-2xl font-semibold mb-2">Welcome back!</h2>
						<p class="text-sm text-gray-600">
							<strong>WebID:</strong> {session.webId}
						</p>
					</div>
					<button
						onclick={() => session.logout()}
						class="px-4 py-2 border rounded-md hover:bg-gray-50"
					>
						Logout
					</button>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<a
						href="/polls/create"
						class="block p-6 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
					>
						<h3 class="text-lg font-semibold text-blue-900 mb-2">Create New Poll</h3>
						<p class="text-blue-700">Start a new conversation and gather perspectives</p>
					</a>

					<div class="p-6 bg-gray-50 border-2 border-gray-200 rounded-lg">
						<h3 class="text-lg font-semibold text-gray-900 mb-2">Join a Poll</h3>
						<p class="text-gray-700 mb-3">Enter a poll ID to participate</p>
						<input
							type="text"
							placeholder="Poll ID"
							class="w-full px-3 py-2 border rounded-md"
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								const pollId = target.value.trim();
								if (pollId) window.location.href = `/polls/${pollId}`;
							}}
						/>
					</div>
				</div>
			</div>

			<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
				<h3 class="font-semibold text-blue-900 mb-2">How it works</h3>
				<ul class="space-y-2 text-blue-800">
					<li>1. Create or join a poll</li>
					<li>2. Add your statements and perspectives</li>
					<li>3. Vote on others' statements (Agree, Disagree, or Pass)</li>
					<li>4. All your data is stored securely in your Solid pod</li>
				</ul>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-md p-8 text-center">
				<h2 class="text-2xl font-semibold mb-4">Get Started</h2>
				<p class="text-gray-600 mb-6">
					Log in with your Solid identity to create and participate in polls
				</p>
				<a
					href="/login"
					class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
				>
					Login with Solid
				</a>
			</div>

			<div class="mt-8 bg-gray-100 border border-gray-300 rounded-lg p-6">
				<h3 class="font-semibold text-gray-900 mb-2">Why Solid Polis?</h3>
				<ul class="space-y-2 text-gray-700">
					<li><strong>Privacy First:</strong> Your data stays in your personal Solid pod</li>
					<li><strong>Decentralized:</strong> No central authority owns your responses</li>
					<li><strong>Transparent:</strong> See how others vote while maintaining privacy</li>
					<li><strong>Open:</strong> Built on open standards and protocols</li>
				</ul>
			</div>
		{/if}
	</div>
</div>
