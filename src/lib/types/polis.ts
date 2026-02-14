// Type definitions for Polis data structures

export interface Poll {
	id: string;
	title: string;
	description: string;
	creator: string; // WebID of the creator
	created: Date;
	participantsUrl?: string; // URL to a list of participant WebIDs
}

export interface Statement {
	id: string;
	pollId: string;
	text: string;
	author: string; // WebID of the author
	authorName?: string;
	created: Date;
}

export interface Vote {
	id: string;
	pollId: string;
	statementId: string;
	voter: string; // WebID of the voter
	value: 'agree' | 'disagree' | 'pass';
	created: Date;
}

export interface VoteCount {
	agree: number;
	disagree: number;
	pass: number;
}

export interface StatementWithVotes extends Statement {
	votes: VoteCount;
	userVote?: 'agree' | 'disagree' | 'pass';
}
