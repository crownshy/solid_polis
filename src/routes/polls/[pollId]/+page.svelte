<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { session } from '$lib/solid/auth.svelte';
	import { PolisStorage } from '$lib/solid/polis-storage';
	import type { Poll, Statement, Vote, StatementWithVotes, VoteCount } from '$lib/types/polis';
	import StatementItem from '$lib/components/StatementItem.svelte';
	import AddStatement from '$lib/components/AddStatement.svelte';
	import Toast from '$lib/components/Toast.svelte';

	const pollId = $derived(page.params.pollId);
	const creatorWebId = $derived(page.url.searchParams.get('creator'));

	// Debug logging
	$effect(() => {
		console.log("Poll page loaded - Poll ID:", pollId);
		console.log("Poll page loaded - Creator WebID from URL:", creatorWebId);
		console.log("Poll page loaded - Full URL:", window.location.href);
	});

	let poll = $state<Poll | null>(null);
	let statements = $state<StatementWithVotes[]>([]);
	let loading = $state(true);
	let error = $state('');
	let voting = $state(false);
	let adding = $state(false);
	let toastMessage = $state('');
	let toastType = $state<'error' | 'success' | 'info'>('error');
	let inviteLinkCopied = $state(false);

	// List of participant WebIDs - loaded from the creator's pod
	let participants = $state<string[]>([]);

	$effect(() => {
		if (session.isLoggedIn && session.webId) {
			loadPoll();
		}
	});

	// Auto-reset the invite link copied state after 3 seconds
	$effect(() => {
		if (inviteLinkCopied) {
			const timer = setTimeout(() => {
				inviteLinkCopied = false;
			}, 3000);
			return () => clearTimeout(timer);
		}
	});

	async function loadPoll() {
		if (!session.webId || !pollId) return;

		loading = true;
		error = '';

		try {
			// Use the authenticated fetch from the session
			const storage = new PolisStorage(session.getFetch());

			// Determine whose pod to load the poll from
			// If creator param is in URL, use that; otherwise try current user's pod
			const pollOwner = creatorWebId || session.webId;

			// Try to load poll from the specified owner's pod
			poll = await storage.getPoll(pollOwner, pollId);

			if (!poll) {
				error = 'Poll not found. Make sure you have access to this poll.';
				loading = false;
				return;
			}

			// Load participants from the creator's pod
			participants = await storage.getParticipants(poll.creator, pollId);
			console.log('Loaded participants:', participants);

			// If no participants found, fall back to creator
			if (participants.length === 0) {
				participants = [poll.creator];
				if (session.webId !== poll.creator) {
					participants.push(session.webId);
				}
			}

			// Load statements and votes from all participants
			await loadStatementsAndVotes(storage);
		} catch (err) {
			error = `Failed to load poll: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			loading = false;
		}
	}

	async function loadStatementsAndVotes(storage: PolisStorage) {
		if (!pollId) return;

		try {
			// Aggregate statements from all participants
			const allStatements = await storage.getAllStatements(participants, pollId);

			// Aggregate votes from all participants
			const allVotes = await storage.getAllVotes(participants, pollId);

			// Calculate vote counts and user votes for each statement
			const statementsWithVotes: StatementWithVotes[] = allStatements.map((statement) => {
				const statementVotes = allVotes.filter((v) => v.statementId === statement.id);
				const userVote = statementVotes.find((v) => v.voter === session.webId);

				const votes: VoteCount = {
					agree: statementVotes.filter((v) => v.value === 'agree').length,
					disagree: statementVotes.filter((v) => v.value === 'disagree').length,
					pass: statementVotes.filter((v) => v.value === 'pass').length
				};

				return {
					...statement,
					votes,
					userVote: userVote?.value
				};
			});

			// Sort by creation date (newest first)
			statements = statementsWithVotes.sort(
				(a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
			);
		} catch (err) {
			console.error('Error loading statements and votes:', err);
		}
	}

	async function handleVote(statementId: string, value: 'agree' | 'disagree' | 'pass') {
		if (!session.webId || !pollId || !poll) return;

		// Find the statement to update
		const statementIndex = statements.findIndex((s) => s.id === statementId);
		if (statementIndex === -1) return;

		// Store original state for rollback
		const originalStatement = { ...statements[statementIndex] };
		const originalVotes = { ...originalStatement.votes };
		const originalUserVote = originalStatement.userVote;

		// Optimistically update the UI
		const statement = statements[statementIndex];

		// Remove old vote count if exists
		if (statement.userVote) {
			statement.votes[statement.userVote]--;
		}

		// Add new vote count
		statement.votes[value]++;
		statement.userVote = value;

		// Trigger reactivity
		statements = [...statements];

		// Try to save in background
		try {
			const storage = new PolisStorage(session.getFetch());
			await storage.addVote(session.webId, pollId, statementId, value, poll.creator);

			// Reload participants list
			const updatedParticipants = await storage.getParticipants(poll.creator, pollId);
			if (updatedParticipants.length > participants.length) {
				participants = updatedParticipants;
				console.log('Updated participants list:', participants);
			}
		} catch (err) {
			// Rollback on error
			statements[statementIndex].votes = originalVotes;
			statements[statementIndex].userVote = originalUserVote;
			statements = [...statements];

			toastMessage = 'Failed to save vote. Please try again.';
			toastType = 'error';
		}
	}

	async function handleAddStatement(text: string) {
		if (!session.webId || !pollId || !poll) return;

		// Create optimistic statement
		const tempId = `temp-${Date.now()}`;
		const optimisticStatement: StatementWithVotes = {
			id: tempId,
			pollId,
			text,
			author: session.webId,
			created: new Date(),
			votes: { agree: 0, disagree: 0, pass: 0 }
		};

		// Add to UI immediately
		statements = [optimisticStatement, ...statements];
		adding = false; // Close the form

		// Try to save in background
		try {
			const storage = new PolisStorage(session.getFetch());
			const savedStatement = await storage.addStatement(
				session.webId,
				pollId,
				text,
				undefined,
				poll.creator
			);

			// Replace temp ID with real ID
			const index = statements.findIndex((s) => s.id === tempId);
			if (index !== -1) {
				statements[index] = {
					...savedStatement,
					votes: { agree: 0, disagree: 0, pass: 0 }
				};
				statements = [...statements];
			}

			// Reload participants list
			const updatedParticipants = await storage.getParticipants(poll.creator, pollId);
			if (updatedParticipants.length > participants.length) {
				participants = updatedParticipants;
				console.log('Updated participants list:', participants);
			}
		} catch (err) {
			// Remove optimistic statement on error
			statements = statements.filter((s) => s.id !== tempId);

			toastMessage = 'Failed to add statement. Please try again.';
			toastType = 'error';
		}
	}

	async function copyInviteLink() {
		if (!poll || !pollId) return;

		const inviteUrl = `${window.location.origin}/polls/${pollId}?creator=${encodeURIComponent(poll.creator)}`;

		try {
			await navigator.clipboard.writeText(inviteUrl);
			inviteLinkCopied = true;
			toastMessage = 'Invite link copied to clipboard!';
			toastType = 'success';
		} catch (err) {
			toastMessage = 'Failed to copy invite link. Please try again.';
			toastType = 'error';
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-4xl mx-auto px-6">
		{#if !session.isLoggedIn}
			<div class="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md">
				<p class="font-medium">Please log in to view this poll</p>
				<a href="/" data-sveltekit-reload class="text-blue-600 hover:underline">Go to home page to login</a>
			</div>
		{:else if loading}
			<div class="text-center py-8">
				<p class="text-gray-600">Loading poll...</p>
			</div>
		{:else if error}
			<div class="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
				{error}
			</div>
		{:else if poll}
			<div class="mb-8">
				<div class="flex items-start justify-between gap-4">
					<div class="flex-1">
						<h1 class="text-3xl font-bold mb-2">{poll.title}</h1>
						{#if poll.description}
							<p class="text-gray-600">{poll.description}</p>
						{/if}
						<p class="text-sm text-gray-500 mt-2">
							Created by {poll.creator === session.webId ? 'you' : poll.creator}
						</p>
					</div>
					{#if poll.creator === session.webId}
						<button
							onclick={copyInviteLink}
							class="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
						>
							{#if inviteLinkCopied}
								<span>✓ Copied!</span>
							{:else}
								<span>🔗 Copy Invite Link</span>
							{/if}
						</button>
					{/if}
				</div>
			</div>

			<div class="mb-6">
				<AddStatement onAdd={handleAddStatement} {adding} />
			</div>

			<div class="space-y-4">
				<h2 class="text-xl font-semibold">Statements ({statements.length})</h2>

				{#if statements.length === 0}
					<div class="text-center py-8 text-gray-500">
						<p>No statements yet. Be the first to add one!</p>
					</div>
				{:else}
					{#each statements as statement (statement.id)}
						<StatementItem {statement} onVote={handleVote} {voting} />
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>

{#if toastMessage}
	<Toast message={toastMessage} type={toastType} onClose={() => (toastMessage = '')} />
{/if}
