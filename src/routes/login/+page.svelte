<script>
	import { goto } from '$app/navigation';
	import { session } from '$lib/solid/auth.svelte';

	let issuer = $state('https://solidcommunity.net');

	$effect(() => {
		if (session.isLoggedIn) {
			goto('/');
		}
	});

	// Automatically redirect if already logged in
</script>

<h1>Login with Solid</h1>

<input bind:value={issuer} placeholder="Solid Identity Provider URL" />

<button onclick={() => session.login(issuer)}> Login </button>

{#if session.info?.isLoggedIn}
	<p>Logged in as: {session.info.webId}</p>
	<button onclick={() => session.logout()}>Logout</button>
{:else}
	<p>Status: Not logged in</p>
{/if}
