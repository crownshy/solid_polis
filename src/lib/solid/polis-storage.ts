import {
	overwriteFile,
	getFile,
	createContainerAt,
	getPodUrlAll,
	saveFileInContainer
} from '@inrupt/solid-client';
import { fetch } from '@inrupt/solid-client-authn-browser';
import type { Poll, Statement, Vote } from '$lib/types/polis';

/**
 * Generate a UUID using the crypto API
 */
function generateUUID(): string {
	return crypto.randomUUID();
}

/**
 * Storage service for Polis data in Solid pods
 * Each user's data (statements, votes) is stored in their own pod
 */
export class PolisStorage {
	private fetch: typeof fetch;
	private podUrlCache: Map<string, string> = new Map();

	constructor(authenticatedFetch: typeof fetch) {
		this.fetch = authenticatedFetch;
		console.log('PolisStorage initialized with fetch:', typeof authenticatedFetch);
		// Verify the fetch has authentication context
		if (!authenticatedFetch) {
			console.error('WARNING: No fetch function provided to PolisStorage!');
		}
	}

	/**
	 * Get the pod URL for a user's WebID
	 */
	async getPodUrl(webId: string): Promise<string> {
		console.log('Getting pod URL for WebID:', webId);

		// Check cache first
		if (this.podUrlCache.has(webId)) {
			const cached = this.podUrlCache.get(webId)!;
			console.log('Using cached pod URL:', cached);
			return cached;
		}

		try {
			// Try to get the actual pod URL(s) for this WebID
			console.log('Fetching pod URLs from WebID profile...');
			const podUrls = await getPodUrlAll(webId, { fetch: this.fetch });

			if (podUrls && podUrls.length > 0) {
				// Use the first pod URL
				const podUrl = podUrls[0];
				console.log('Found pod URL from profile:', podUrl);
				this.podUrlCache.set(webId, podUrl);
				return podUrl;
			} else {
				console.warn('No pod URLs found in WebID profile');
			}
		} catch (error) {
			console.warn('Failed to fetch pod URLs from WebID profile:', error);
		}

		// Fallback: Try to construct pod URL from WebID for common providers
		// For Inrupt: WebID like https://id.inrupt.com/username/profile/card#me
		//             Pod is at https://storage.inrupt.com/username/
		const webIdUrl = new URL(webId);

		if (webIdUrl.hostname === 'id.inrupt.com') {
			// Extract username from path (e.g., /username/profile/card#me -> username)
			const pathParts = webIdUrl.pathname.split('/').filter(p => p.length > 0);
			if (pathParts.length > 0) {
				const username = pathParts[0];
				const podUrl = `https://storage.inrupt.com/${username}/`;
				console.log(`Using fallback Inrupt pod URL: ${podUrl}`);
				this.podUrlCache.set(webId, podUrl);
				return podUrl;
			}
		}

		// If all else fails, use the WebID's origin as the pod URL
		const fallbackUrl = `${webIdUrl.protocol}//${webIdUrl.host}/`;
		console.warn(`Using WebID origin as fallback pod URL: ${fallbackUrl}`);
		this.podUrlCache.set(webId, fallbackUrl);
		return fallbackUrl;
	}

	/**
	 * Get the polis container URL for a user's pod
	 */
	async getPolisContainerUrl(webId: string): Promise<string> {
		const podUrl = await this.getPodUrl(webId);
		return `${podUrl}polis/`;
	}

	/**
	 * Get the URL for a specific poll's data in a user's pod
	 */
	async getPollUrl(webId: string, pollId: string): Promise<string> {
		const polisContainer = await this.getPolisContainerUrl(webId);
		return `${polisContainer}polls/${pollId}`;
	}

	/**
	 * Get the URL for storing statements in a user's pod
	 */
	async getStatementsUrl(webId: string, pollId: string): Promise<string> {
		const pollUrl = await this.getPollUrl(webId, pollId);
		return `${pollUrl}/statements.json`;
	}

	/**
	 * Get the URL for storing votes in a user's pod
	 */
	async getVotesUrl(webId: string, pollId: string): Promise<string> {
		const pollUrl = await this.getPollUrl(webId, pollId);
		return `${pollUrl}/votes.json`;
	}

	/**
	 * Ensure a container exists at the given URL
	 */
	private async ensureContainer(containerUrl: string): Promise<void> {
		try {
			console.log('Creating container:', containerUrl);
			const result = await createContainerAt(containerUrl, { fetch: this.fetch });
			console.log('Container created successfully:', containerUrl);
		} catch (error: any) {
			// Check if it's a 409 (conflict) which means container already exists
			if (error?.response?.status === 409 || error?.statusCode === 409) {
				console.log('Container already exists:', containerUrl);
			} else {
				console.error('Error creating container:', containerUrl, error);
				throw error;
			}
		}
	}

	/**
	 * Create or join a poll
	 */
	async createPoll(webId: string, poll: Omit<Poll, 'id' | 'created'>): Promise<Poll> {
		const pollId = generateUUID();
		const newPoll: Poll = {
			...poll,
			id: pollId,
			created: new Date()
		};

		try {
			// Ensure the polis container exists
			const polisContainer = await this.getPolisContainerUrl(webId);
			await this.ensureContainer(polisContainer);

			// Ensure the polls container exists
			const pollsContainer = `${polisContainer}polls/`;
			await this.ensureContainer(pollsContainer);

			// Ensure the specific poll container exists
			const pollContainer = `${await this.getPollUrl(webId, pollId)}/`;
			await this.ensureContainer(pollContainer);

			// Save the poll data
			console.log('Saving poll to container:', pollContainer);
			const blob = new Blob([JSON.stringify(newPoll)], { type: 'application/json' });

			// Use saveFileInContainer which handles creation better
			const savedFile = await saveFileInContainer(
				pollContainer,
				blob,
				{
					slug: 'poll.json',
					contentType: 'application/json',
					fetch: this.fetch
				}
			);
			console.log('Poll saved successfully at:', savedFile);
		} catch (error) {
			console.error('Error creating poll:', error);
			throw error;
		}

		return newPoll;
	}

	/**
	 * Get poll metadata
	 */
	async getPoll(webId: string, pollId: string): Promise<Poll | null> {
		try {
			const pollUrl = `${await this.getPollUrl(webId, pollId)}/poll.json`;
			const file = await getFile(pollUrl, { fetch: this.fetch });
			const text = await file.text();
			return text ? JSON.parse(text) : null;
		} catch (error) {
			console.error('Error fetching poll:', error);
			return null;
		}
	}

	/**
	 * Add a statement to a poll
	 */
	async addStatement(
		webId: string,
		pollId: string,
		text: string,
		authorName?: string
	): Promise<Statement> {
		const statement: Statement = {
			id: generateUUID(),
			pollId,
			text,
			author: webId,
			authorName,
			created: new Date()
		};

		const statementsUrl = await this.getStatementsUrl(webId, pollId);

		try {
			// Try to get existing statements
			let statements: Statement[] = [];
			try {
				const file = await getFile(statementsUrl, { fetch: this.fetch });
				const text = await file.text();
				statements = text ? JSON.parse(text) : [];
			} catch (e) {
				// File doesn't exist yet, that's fine
			}

			statements.push(statement);

			// Save updated statements
			const blob = new Blob([JSON.stringify(statements)], { type: 'application/json' });
			await overwriteFile(statementsUrl, blob, { fetch: this.fetch });
		} catch (error) {
			console.error('Error adding statement:', error);
			throw error;
		}

		return statement;
	}

	/**
	 * Get statements from a user's pod for a specific poll
	 */
	async getStatements(webId: string, pollId: string): Promise<Statement[]> {
		try {
			const statementsUrl = await this.getStatementsUrl(webId, pollId);
			const file = await getFile(statementsUrl, { fetch: this.fetch });
			const text = await file.text();
			return text ? JSON.parse(text) : [];
		} catch (error) {
			// File might not exist yet
			return [];
		}
	}

	/**
	 * Add a vote for a statement
	 */
	async addVote(
		webId: string,
		pollId: string,
		statementId: string,
		value: 'agree' | 'disagree' | 'pass'
	): Promise<Vote> {
		const vote: Vote = {
			id: generateUUID(),
			pollId,
			statementId,
			voter: webId,
			value,
			created: new Date()
		};

		const votesUrl = await this.getVotesUrl(webId, pollId);

		try {
			// Try to get existing votes
			let votes: Vote[] = [];
			try {
				const file = await getFile(votesUrl, { fetch: this.fetch });
				const text = await file.text();
				votes = text ? JSON.parse(text) : [];
			} catch (e) {
				// File doesn't exist yet, that's fine
			}

			// Remove any existing vote for this statement
			const filteredVotes = votes.filter((v) => v.statementId !== statementId);
			filteredVotes.push(vote);

			// Save updated votes
			const blob = new Blob([JSON.stringify(filteredVotes)], { type: 'application/json' });
			await overwriteFile(votesUrl, blob, { fetch: this.fetch });
		} catch (error) {
			console.error('Error adding vote:', error);
			throw error;
		}

		return vote;
	}

	/**
	 * Get votes from a user's pod for a specific poll
	 */
	async getVotes(webId: string, pollId: string): Promise<Vote[]> {
		try {
			const votesUrl = await this.getVotesUrl(webId, pollId);
			const file = await getFile(votesUrl, { fetch: this.fetch });
			const text = await file.text();
			return text ? JSON.parse(text) : [];
		} catch (error) {
			// File might not exist yet
			return [];
		}
	}

	/**
	 * Aggregate statements from multiple participants
	 */
	async getAllStatements(participantWebIds: string[], pollId: string): Promise<Statement[]> {
		const allStatements: Statement[] = [];

		await Promise.all(
			participantWebIds.map(async (webId) => {
				const statements = await this.getStatements(webId, pollId);
				allStatements.push(...statements);
			})
		);

		return allStatements;
	}

	/**
	 * Aggregate votes from multiple participants
	 */
	async getAllVotes(participantWebIds: string[], pollId: string): Promise<Vote[]> {
		const allVotes: Vote[] = [];

		await Promise.all(
			participantWebIds.map(async (webId) => {
				const votes = await this.getVotes(webId, pollId);
				allVotes.push(...votes);
			})
		);

		return allVotes;
	}
}
