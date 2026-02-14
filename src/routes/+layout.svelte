<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { handleRedirectAfterLogin } from '$lib/solid/auth.svelte';

	let { children } = $props();

	onMount(() => {
		handleRedirectAfterLogin();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
