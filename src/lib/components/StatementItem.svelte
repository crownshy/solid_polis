<script lang="ts">
	import type { StatementWithVotes } from '$lib/types/polis';

	interface Props {
		statement: StatementWithVotes;
		onVote: (statementId: string, value: 'agree' | 'disagree' | 'pass') => void;
		voting: boolean;
	}

	let { statement, onVote, voting }: Props = $props();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString();
	}

	function getVoteButtonClass(voteType: 'agree' | 'disagree' | 'pass'): string {
		const baseClass = 'px-4 py-2 rounded-md font-medium transition-colors';
		const isActive = statement.userVote === voteType;

		if (voteType === 'agree') {
			return `${baseClass} ${isActive ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`;
		} else if (voteType === 'disagree') {
			return `${baseClass} ${isActive ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'}`;
		} else {
			return `${baseClass} ${isActive ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
		}
	}
</script>

<div class="border rounded-lg p-4 bg-white shadow-sm">
	<div class="mb-3">
		<p class="text-lg">{statement.text}</p>
		<p class="text-sm text-gray-500 mt-1">
			by {statement.authorName || 'Anonymous'} · {formatDate(statement.created)}
		</p>
	</div>

	<div class="flex gap-2 mb-3">
		<button
			onclick={() => onVote(statement.id, 'agree')}
			disabled={voting}
			class={getVoteButtonClass('agree')}
		>
			Agree {statement.votes.agree > 0 ? `(${statement.votes.agree})` : ''}
		</button>

		<button
			onclick={() => onVote(statement.id, 'disagree')}
			disabled={voting}
			class={getVoteButtonClass('disagree')}
		>
			Disagree {statement.votes.disagree > 0 ? `(${statement.votes.disagree})` : ''}
		</button>

		<button
			onclick={() => onVote(statement.id, 'pass')}
			disabled={voting}
			class={getVoteButtonClass('pass')}
		>
			Pass {statement.votes.pass > 0 ? `(${statement.votes.pass})` : ''}
		</button>
	</div>
</div>
