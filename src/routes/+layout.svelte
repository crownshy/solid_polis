<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { handleRedirectAfterLogin, session } from '$lib/solid/auth.svelte';

	let { children } = $props();

	// Restore session on app load (client-side only)
	onMount(async () => {
		console.log("=== Layout onMount START ===");

		// Store poll URL BEFORE session restoration, in case OAuth flow redirects us away
		const currentPath = window.location.pathname + window.location.search;
		const isOAuthCallback = currentPath.includes('code=') && currentPath.includes('state=');
		const existingStoredPath = sessionStorage.getItem('solid-polis-post-login-path');

		console.log("Layout - Current path:", currentPath);
		console.log("Layout - Existing stored path:", existingStoredPath);
		console.log("Layout - Is OAuth callback:", isOAuthCallback);

		// Only store if:
		// 1. It's a poll page (not create page)
		// 2. NOT an OAuth callback
		// 3. There's no stored path already OR the stored path is different from current path
		if (
			!isOAuthCallback &&
			currentPath.startsWith('/polls/') &&
			currentPath !== '/polls/create' &&
			(!existingStoredPath || existingStoredPath !== currentPath)
		) {
			sessionStorage.setItem('solid-polis-post-login-path', currentPath);
			console.log(">>> STORED poll URL before session restoration:", currentPath);
			console.log(">>> OVERWROTE existing path:", existingStoredPath);
		}

		await handleRedirectAfterLogin();

		console.log("=== Layout onMount END ===");
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if session.isRestoringSession}
	<div class="min-h-screen bg-gray-50 flex items-center justify-center">
		<div class="text-center">
			<div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
			<p class="text-gray-600">Loading...</p>
		</div>
	</div>
{:else}
	{@render children()}
{/if}
