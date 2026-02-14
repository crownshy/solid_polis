<script lang="ts">
	import { page } from '$app/state';
	import { session } from '$lib/solid/auth.svelte';
	import { PolisStorage } from '$lib/solid/polis-storage';
	import type { Poll, Statement, Vote, StatementWithVotes, VoteCount } from '$lib/types/polis';
	import StatementItem from '$lib/components/StatementItem.svelte';
	import AddStatement from '$lib/components/AddStatement.svelte';

	const pollId = $derived(page.params.pollId);

	let poll = $state<Poll | null>(null);
	let statements = $state<StatementWithVotes[]>([]);
	let loading = $state(true);
	let error = $state('');
	let voting = $state(false);
	let adding = $state(false);

	// List of participant WebIDs - in a real app, this would come from the poll metadata
	// For now, we'll just use the current user and creator
	let participants = $state<string[]>([]);

	$effect(() => {
		if (session.isLoggedIn && session.webId) {
			loadPoll();
		}
	});

	async function loadPoll() {
		if (!session.webId || !pollId) return;

		loading = true;
		error = '';

		try {
			// Use the authenticated fetch from the session
			const storage = new PolisStorage(session.getFetch());

			// Try to load poll from creator's pod (current user for now)
			poll = await storage.getPoll(session.webId, pollId);

			if (!poll) {
				error = 'Poll not found. Make sure you have access to this poll.';
				loading = false;
				return;
			}

			// Set participants (creator + current user)
			participants = [poll.creator];
			if (session.webId !== poll.creator) {
				participants.push(session.webId);
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
		if (!session.webId || !pollId) return;

		voting = true;

		try {
			const storage = new PolisStorage(session.getFetch());
			await storage.addVote(session.webId, pollId, statementId, value);

			// Reload statements and votes to reflect the change
			await loadStatementsAndVotes(storage);
		} catch (err) {
			error = `Failed to vote: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			voting = false;
		}
	}

	async function handleAddStatement(text: string) {
		if (!session.webId || !pollId) return;

		adding = true;

		try {
			const storage = new PolisStorage(session.getFetch());
			await storage.addStatement(session.webId, pollId, text);

			// Reload statements and votes to include the new statement
			await loadStatementsAndVotes(storage);
		} catch (err) {
			error = `Failed to add statement: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			adding = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-4xl mx-auto px-6">
		{#if !session.isLoggedIn}
			<div class="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-md">
				<p class="font-medium">Please log in to view this poll</p>
				<a href="/login" class="text-blue-600 hover:underline">Go to login</a>
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
				<h1 class="text-3xl font-bold mb-2">{poll.title}</h1>
				{#if poll.description}
					<p class="text-gray-600">{poll.description}</p>
				{/if}
				<p class="text-sm text-gray-500 mt-2">
					Created by {poll.creator === session.webId ? 'you' : poll.creator}
				</p>
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
