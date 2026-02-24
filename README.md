# Solid Polis

A privacy-preserving collaborative polling application built on the Solid Protocol using Svelte 5 and LDO (Linked Data Objects).

This is a work in progress currently we have 

1. Generating a polis poll. This creates a record in the creators pod.
2. Submitting statements and votes that are stored in a users solid pod 
3. Invite links to join a poll
4. Live updating of statements and polls 

What we still need are 

1. A way to run the math server over the results to produce reports 
2. A way to cryptographically sign a statement / vote pair to ensure that we can detect if someone changes a statement and invalidate those votes on it.
3. Ways of restricting access to a poll

## Features

- **Privacy-First**: All user data (statements, votes) is stored in individual Solid pods
- **Decentralized**: No central server stores your data
- **Collaborative**: Create polls, share statements, and vote on perspectives
- **Open Standards**: Built on Solid Protocol and Linked Data principles

## How It Works

1. **Authentication**: Users log in with their Solid identity (WebID)
2. **Create or Join Polls**: Start a new conversation or join an existing one
3. **Add Statements**: Share your perspectives on the poll topic
4. **Vote**: Express agreement, disagreement, or pass on others' statements
5. **Privacy**: All your data stays in your Solid pod under your control

## Data Storage

Each user's data is stored in their own Solid pod:

```
{pod-root}/polis/
  polls/
    {poll-id}/
      poll.json         # Poll metadata
      statements.json   # User's statements for this poll
      votes.json        # User's votes for this poll
```

## Technology Stack

- **Svelte 5**: Modern reactive UI framework with runes
- **SvelteKit**: Full-stack framework for routing and SSR
- **Solid Protocol**: Decentralized data storage specification
- **LDO (Linked Data Objects)**: Type-safe Linked Data manipulation
- **@ldo/svelte**: Svelte bindings for LDO
- **Tailwind CSS**: Utility-first styling

## Getting Started

### Prerequisites

- Node.js 18+
- A Solid Pod (get one free at [inrupt.net](https://start.inrupt.com/profile))

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. Navigate to `http://localhost:5173`
2. Click "Login with Solid" and authenticate with your Solid provider
3. Create a new poll or join an existing one by entering a poll ID
4. Add statements and vote on others' perspectives

## Architecture

### Components

- **PollCreate.svelte**: Interface for creating new polls
- **StatementItem.svelte**: Display and vote on individual statements
- **AddStatement.svelte**: Form for adding new statements to a poll

### Services

- **polis-storage.ts**: Handles all Solid pod interactions using LDO
  - Creating and retrieving polls
  - Adding and fetching statements
  - Recording and retrieving votes
  - Aggregating data from multiple participants

### Routes

- `/`: Home page with login and navigation
- `/login`: Solid authentication page
- `/polls/create`: Create a new poll
- `/polls/[pollId]`: View and participate in a specific poll

## Data Models

### Poll
```typescript
{
  id: string;
  title: string;
  description: string;
  creator: string; // WebID
  created: Date;
}
```

### Statement
```typescript
{
  id: string;
  pollId: string;
  text: string;
  author: string; // WebID
  authorName?: string;
  created: Date;
}
```

### Vote
```typescript
{
  id: string;
  pollId: string;
  statementId: string;
  voter: string; // WebID
  value: 'agree' | 'disagree' | 'pass';
  created: Date;
}
```

## Privacy & Security

- **Data Sovereignty**: Users maintain full control over their data in their Solid pods
- **Decentralized**: No central database or server stores user data
- **Consent-Based**: Users explicitly choose to participate in polls
- **Transparent**: Open source code allows full inspection of data handling

## Future Enhancements

- [ ] Participant management (adding/inviting users to polls)
- [ ] Visualization of voting patterns
- [ ] Export poll results
- [ ] Poll templates
- [ ] Real-time updates using Solid notifications
- [ ] Access control and privacy settings
- [ ] Poll archiving and history

## Development

### Project Structure

```
src/
  lib/
    components/      # Reusable Svelte components
    solid/          # Solid Protocol integration
    types/          # TypeScript type definitions
  routes/           # SvelteKit routes
```

### Building

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:unit
```

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT

## Acknowledgments

- Built with [Svelte](https://svelte.dev/)
- Powered by [Solid Protocol](https://solidproject.org/)
- Uses [LDO](https://github.com/o-development/ldo) for Linked Data manipulation
