<script>
	import { onMount } from 'svelte';
	import { MicVAD } from '@ricky0123/vad-web';

	let myvad;

	onMount(async () => {
		myvad = await MicVAD.new({
			onSpeechEnd: (audio) => {
				console.log('onSpeechEnd');
				// do something with `audio` (Float32Array of audio samples at sample rate 16000)...
			}
		});
		myvad.start();
	});
</script>
