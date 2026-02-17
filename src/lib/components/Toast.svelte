<script lang="ts">
	interface Props {
		message: string;
		type?: 'error' | 'success' | 'info';
		onClose: () => void;
	}

	let { message, type = 'error', onClose }: Props = $props();

	const bgColor = {
		error: 'bg-red-100 border-red-400 text-red-700',
		success: 'bg-green-100 border-green-400 text-green-700',
		info: 'bg-blue-100 border-blue-400 text-blue-700'
	}[type];

	// Auto-dismiss after 5 seconds
	$effect(() => {
		const timer = setTimeout(onClose, 5000);
		return () => clearTimeout(timer);
	});
</script>

<div class="fixed bottom-4 right-4 max-w-md z-50 animate-slide-in">
	<div class="border-l-4 p-4 rounded shadow-lg {bgColor}">
		<div class="flex items-center justify-between">
			<p class="font-medium">{message}</p>
			<button onclick={onClose} class="ml-4 text-xl leading-none hover:opacity-70">×</button>
		</div>
	</div>
</div>

<style>
	@keyframes slide-in {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.animate-slide-in {
		animation: slide-in 0.3s ease-out;
	}
</style>
