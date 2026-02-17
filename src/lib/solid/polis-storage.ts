import { createSolidLdoDataset } from '@ldo/connected-solid';
import {
	getPodUrlAll,
	overwriteFile,
	getContainedResourceUrlAll,
	getResourceAcl,
	hasResourceAcl,
	hasFallbackAcl,
	createAcl,
	createAclFromFallbackAcl,
	getPublicAccess,
	getPublicResourceAccess,
	setPublicResourceAccess,
	saveAclFor
} from '@inrupt/solid-client';
import {
	setPublicAccess
} from '@inrupt/solid-client/universal';
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
	private dataset;
	private fetch: typeof fetch;
	private podUrlCache: Map<string, string> = new Map();

	constructor(authenticatedFetch: typeof fetch) {
		this.fetch = authenticatedFetch;
		this.dataset = createSolidLdoDataset();
		this.dataset.setContext('solid', { fetch: authenticatedFetch });
		console.log('PolisStorage initialized with LDO dataset');
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

		// Fallback: For Solid Community, pod is usually at the same origin as WebID
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
		} else if (webIdUrl.hostname === 'solidcommunity.net') {
			// For Solid Community, extract username and construct pod URL
			// WebID like https://solidcommunity.net/username/profile/card#me
			// Pod is at https://solidcommunity.net/username/
			const pathParts = webIdUrl.pathname.split('/').filter(p => p.length > 0);
			if (pathParts.length > 0) {
				const username = pathParts[0];
				const podUrl = `https://solidcommunity.net/${username}/`;
				console.log(`Using fallback Solid Community pod URL: ${podUrl}`);
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
		return `${pollUrl}/statements`;
	}

	/**
	 * Get the URL for storing votes in a user's pod
	 */
	async getVotesUrl(webId: string, pollId: string): Promise<string> {
		const pollUrl = await this.getPollUrl(webId, pollId);
		return `${pollUrl}/votes`;
	}

	/**
	 * Get the URL for the participants file in the creator's pod
	 */
	async getParticipantsUrl(creatorWebId: string, pollId: string): Promise<string> {
		const pollUrl = await this.getPollUrl(creatorWebId, pollId);
		return `${pollUrl}/participants`;
	}


	/**
	 * Ensure a container exists by creating it if absent
	 */
	private async ensureContainerExists(containerUrl: string): Promise<void> {
		console.log('Ensuring container exists:', containerUrl);
		const resource = this.dataset.getResource(containerUrl);

		if ('createIfAbsent' in resource) {
			const result = await (resource as any).createIfAbsent();
			console.log('Container creation result:', result.type);
		}
	}

	/**
	 * Set public write access on a resource by creating a custom ACL file
	 */
	private async setPublicWriteAccess(resourceUrl: string, ownerWebId: string): Promise<void> {
		try {
			console.log('Setting public write access on:', resourceUrl);

			// Create ACL content manually in Turtle format
			const aclContent = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.

# Owner has full control
<#owner>
    a acl:Authorization;
    acl:agent <${ownerWebId}>;
    acl:accessTo <${resourceUrl}>;
    acl:mode acl:Read, acl:Write, acl:Control.

# Public can read and write
<#public>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <${resourceUrl}>;
    acl:mode acl:Read, acl:Write.
`;

			// The ACL file URL is the resource URL + .acl
			const aclUrl = `${resourceUrl}.acl`;

			// Write the ACL file
			const blob = new Blob([aclContent], { type: 'text/turtle' });
			await overwriteFile(aclUrl, blob, { fetch: this.fetch });
			console.log('✓ Public write ACL created at:', aclUrl);
		} catch (error) {
			console.error('Error setting public write access:', error);
			throw error;
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
			// Ensure parent containers exist in order
			const polisContainer = await this.getPolisContainerUrl(webId);
			await this.ensureContainerExists(polisContainer);

			await this.ensureContainerExists(`${polisContainer}polls/`);

			const pollContainer = `${await this.getPollUrl(webId, pollId)}/`;
			await this.ensureContainerExists(pollContainer);

			// Now create the poll resource
			const pollUrl = `${pollContainer}poll`;
			console.log('Creating poll resource at:', pollUrl);

			const resource = this.dataset.getResource(pollUrl);

			// Create the resource
			if ('createIfAbsent' in resource) {
				console.log('Calling createIfAbsent on poll resource...');
				const createResult = await (resource as any).createIfAbsent();
				console.log('Poll resource created:', createResult.type);
			}

			// Use Solid Client's overwriteFile which reliably writes files
			console.log('Writing poll data with overwriteFile...');
			const blob = new Blob([JSON.stringify(newPoll)], { type: 'application/json' });
			await overwriteFile(pollUrl, blob, { fetch: this.fetch });
			console.log('Poll data written successfully');

			// Verify by reading it back
			console.log('Verifying poll was saved...');
			await resource.read();
			if ('getBlob' in resource) {
				const blob = (resource as any).getBlob();
				if (blob) {
					const text = await blob.text();
					const savedPoll = JSON.parse(text);
					console.log('✓ Poll verified! ID:', savedPoll.id);
				} else {
					console.error('✗ Failed to verify - blob is null');
				}
			}

			// Set public read permissions so others can access via invite links
			console.log('Setting public read permissions...');
			try {
				// Set public read access on the poll file using Universal Access Control
				await setPublicAccess(
					pollUrl,
					{ read: true, append: false, write: false },
					{ fetch: this.fetch }
				);
				console.log('✓ Public read permissions set on poll');

				// Also set public read on the poll container
				await setPublicAccess(
					pollContainer,
					{ read: true, append: false, write: false },
					{ fetch: this.fetch }
				);
				console.log('✓ Public read permissions set on poll container');
			} catch (permError) {
				console.warn('Could not set public permissions (this is okay, poll is still created):', permError);
			}

			// Create participants file with public write access
			console.log('Creating participants file...');
			try {
				const participantsUrl = `${pollContainer}participants`;

				// Initialize with creator
				const initialParticipants = [webId];
				const blob = new Blob([JSON.stringify(initialParticipants)], { type: 'application/json' });
				await overwriteFile(participantsUrl, blob, { fetch: this.fetch });
				console.log('✓ Participants file created');

				// Set public read and write permissions by creating a custom ACL
				await this.setPublicWriteAccess(participantsUrl, webId);
				console.log('✓ Public read/write permissions set on participants file');
			} catch (permError) {
				console.warn('Could not create/set permissions on participants file:', permError);
			}

			console.log('Poll saved successfully');
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
			const pollUrl = `${await this.getPollUrl(webId, pollId)}/poll`;
			const resource = this.dataset.getResource(pollUrl);
			await resource.read();

			if ('getBlob' in resource) {
				const blob = resource.getBlob();
				if (blob) {
					const text = await blob.text();
					return text ? JSON.parse(text) : null;
				}
			}
			return null;
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
		authorName?: string,
		creatorWebId?: string
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
			// Try to read existing statements
			let statements: Statement[] = [];
			let isNewFile = false;
			try {
				const response = await this.fetch(statementsUrl);
				if (response.ok) {
					const text = await response.text();
					statements = text ? JSON.parse(text) : [];
				} else if (response.status === 404) {
					isNewFile = true;
				}
			} catch (e) {
				// Resource doesn't exist yet, that's fine
				isNewFile = true;
			}

			statements.push(statement);

			// Write updated statements using overwriteFile
			const blob = new Blob([JSON.stringify(statements)], { type: 'application/json' });
			await overwriteFile(statementsUrl, blob, { fetch: this.fetch });
			console.log('Statement added successfully');

			// Set public read permissions on first creation
			if (isNewFile) {
				try {
					await setPublicAccess(
						statementsUrl,
						{ read: true, append: false, write: false },
						{ fetch: this.fetch }
					);
					console.log('✓ Public read permissions set on statements file');
				} catch (permError) {
					console.warn('Could not set public permissions on statements:', permError);
				}
			}

			// Register user as a participant if creator is provided
			if (creatorWebId && webId !== creatorWebId) {
				await this.addParticipant(creatorWebId, pollId, webId);
			}
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
			const resource = this.dataset.getResource(statementsUrl);
			await resource.read();

			if ('getBlob' in resource) {
				const blob = resource.getBlob();
				if (blob) {
					const text = await blob.text();
					return text ? JSON.parse(text) : [];
				}
			}
			return [];
		} catch (error) {
			// Resource might not exist yet
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
		value: 'agree' | 'disagree' | 'pass',
		creatorWebId?: string
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
			// Try to read existing votes
			let votes: Vote[] = [];
			let isNewFile = false;
			try {
				const response = await this.fetch(votesUrl);
				if (response.ok) {
					const text = await response.text();
					votes = text ? JSON.parse(text) : [];
				} else if (response.status === 404) {
					isNewFile = true;
				}
			} catch (e) {
				// Resource doesn't exist yet, that's fine
				isNewFile = true;
			}

			// Remove any existing vote for this statement
			const filteredVotes = votes.filter((v) => v.statementId !== statementId);
			filteredVotes.push(vote);

			// Write updated votes using overwriteFile
			const blob = new Blob([JSON.stringify(filteredVotes)], { type: 'application/json' });
			await overwriteFile(votesUrl, blob, { fetch: this.fetch });
			console.log('Vote added successfully');

			// Set public read permissions on first creation
			if (isNewFile) {
				try {
					await setPublicAccess(
						votesUrl,
						{ read: true, append: false, write: false },
						{ fetch: this.fetch }
					);
					console.log('✓ Public read permissions set on votes file');
				} catch (permError) {
					console.warn('Could not set public permissions on votes:', permError);
				}
			}

			// Register user as a participant if creator is provided
			if (creatorWebId && webId !== creatorWebId) {
				await this.addParticipant(creatorWebId, pollId, webId);
			}
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
			const resource = this.dataset.getResource(votesUrl);
			await resource.read();

			if ('getBlob' in resource) {
				const blob = resource.getBlob();
				if (blob) {
					const text = await blob.text();
					return text ? JSON.parse(text) : [];
				}
			}
			return [];
		} catch (error) {
			// Resource might not exist yet
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

	/**
	 * List all polls for a user
	 */
	async listUserPolls(webId: string): Promise<Poll[]> {
		try {
			const pollsContainer = `${await this.getPolisContainerUrl(webId)}polls/`;
			console.log('Listing polls from:', pollsContainer);

			// Get all resources in the polls container
			const response = await this.fetch(pollsContainer);
			if (!response.ok) {
				console.log('Polls container does not exist yet');
				return [];
			}

			const containerData = await response.text();

			// Parse the container to get poll IDs
			// Extract URLs that look like poll directories
			const pollIdRegex = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//g;
			const matches = [...containerData.matchAll(pollIdRegex)];
			const pollIds = [...new Set(matches.map(m => m[1]))];

			console.log('Found poll IDs:', pollIds);

			// Fetch each poll's metadata
			const polls: Poll[] = [];
			await Promise.all(
				pollIds.map(async (pollId) => {
					const poll = await this.getPoll(webId, pollId);
					if (poll) {
						polls.push(poll);
					}
				})
			);

			return polls.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		} catch (error) {
			console.error('Error listing polls:', error);
			return [];
		}
	}

	/**
	 * Check if user has participated in a poll (has statements or votes)
	 */
	async hasParticipated(webId: string, pollId: string): Promise<boolean> {
		try {
			const [statements, votes] = await Promise.all([
				this.getStatements(webId, pollId),
				this.getVotes(webId, pollId)
			]);

			return statements.length > 0 || votes.length > 0;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get all participants for a poll from the creator's pod
	 */
	async getParticipants(creatorWebId: string, pollId: string): Promise<string[]> {
		try {
			const participantsUrl = await this.getParticipantsUrl(creatorWebId, pollId);
			const response = await this.fetch(participantsUrl);

			if (!response.ok) {
				if (response.status === 404) {
					// Participants file doesn't exist yet
					return [];
				}
				throw new Error(`Failed to fetch participants: ${response.status}`);
			}

			const text = await response.text();
			const participants: string[] = text ? JSON.parse(text) : [];

			// Return unique participants
			return [...new Set(participants)];
		} catch (error) {
			console.error('Error getting participants:', error);
			return [];
		}
	}

	/**
	 * Add a participant to the poll's participant list in the creator's pod
	 */
	async addParticipant(creatorWebId: string, pollId: string, participantWebId: string): Promise<void> {
		try {
			const participantsUrl = await this.getParticipantsUrl(creatorWebId, pollId);

			// Get existing participants
			let participants: string[] = [];
			try {
				const response = await this.fetch(participantsUrl);
				if (response.ok) {
					const text = await response.text();
					participants = text ? JSON.parse(text) : [];
				}
			} catch (e) {
				// File doesn't exist yet, that's fine
			}

			// Add new participant if not already in list
			if (!participants.includes(participantWebId)) {
				participants.push(participantWebId);

				// Write updated participants list
				const blob = new Blob([JSON.stringify(participants)], { type: 'application/json' });
				await overwriteFile(participantsUrl, blob, { fetch: this.fetch });
				console.log('✓ Participant added:', participantWebId);
			}
		} catch (error) {
			console.error('Error adding participant:', error);
			// Don't throw - participation tracking is optional
		}
	}

}
