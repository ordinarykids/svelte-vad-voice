<script>
	import { Button } from '$lib/components/ui/button';

	let status = 'Click the button to play audio.';
	let hasPlayed = false;
	let isPlaying = false;
	let audio;

	function playAudio() {
		if (!hasPlayed) {
			audio = new Audio('/intro.wav');

			audio
				.play()
				.then(() => {
					status = 'Audio is playing...';
					isPlaying = true;
					hasPlayed = true;
				})
				.catch((error) => {
					console.error('Playback failed:', error);
					status = 'Playback failed. Please try again.';
				});

			audio.onended = () => {
				status = 'Audio playback finished.';
				isPlaying = false;
			};
		}
	}
</script>

<Button on:click={playAudio} disabled={isPlaying || hasPlayed} class="mb-4">Play Audio</Button>
<p class="text-xs text-gray-600">{status}</p>
