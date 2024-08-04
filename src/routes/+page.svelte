<script>
	import { onMount, onDestroy } from 'svelte';
	import { Toaster, toast } from 'svelte-sonner';
	// import { EnterIcon, LoadingIcon } from '$lib/icons';
	import { playerStore } from '$lib/playerStore';
	import { MicVAD, utils } from '@ricky0123/vad-web';
	// import AudioPlayer from '$lib/intro-audio.svelte';
	// import { track } from '@vercel/analytics';

	let input = '';
	let inputElement;
	let messages = [];
	let isPending = false;
	let vad;
	let player;
	let probIsSpeech;

	let audioContext;
	let analyser;
	let microphone;
	let volume = 0;

	function reduceToTwoDecimals(number) {
		return Number(number.toFixed(2));
	}

	onMount(async () => {
		player = playerStore;

		vad = await MicVAD.new({
			startOnLoad: true,
			onSpeechStart: () => {
				// console.log('well well');
			},
			onFrameProcessed: (probs) => {
				// probIsSpeech = reduceToTwoDecimals(probs.isSpeech);
				// if (probIsSpeech >= 0.5 && volume >= 40) {
				// 	console.log('probIsSpeech', probIsSpeech);
				// 	player.stop();
				// }
			},
			onSpeechEnd: (audio) => {
				const wav = utils.encodeWAV(audio);
				const blob = new Blob([wav], { type: 'audio/wav' });
				// console.log('volume high', volume);

				player.stop();
				submit(blob);

				const isFirefox = navigator.userAgent.includes('Firefox');
				if (isFirefox) vad.pause();
			},
			workletURL: '/vad.worklet.bundle.min.js',
			modelURL: '/silero_vad.onnx',
			positiveSpeechThreshold: 0.6,
			minSpeechFrames: 4,
			ortConfig(ort) {
				const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
				ort.env.wasm = {
					wasmPaths: {
						'ort-wasm-simd-threaded.wasm': '/ort-wasm-simd-threaded.wasm',
						'ort-wasm-simd.wasm': '/ort-wasm-simd.wasm',
						'ort-wasm.wasm': '/ort-wasm.wasm',
						'ort-wasm-threaded.wasm': '/ort-wasm-threaded.wasm'
					},
					numThreads: isSafari ? 1 : 4
				};
			}
		});
		vad.start();
		try {
			/// VOUME MONITOR
			audioContext = new (window.AudioContext || window.webkitAudioContext)();

			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

			// Create an analyser node
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 256;

			// Connect the microphone to the analyser
			microphone = audioContext.createMediaStreamSource(stream);
			microphone.connect(analyser);

			// Start monitoring the volume
			updateVolume();
		} catch (error) {
			console.error('Error accessing microphone:', error);
		}

		const handleKeyDown = (e) => {
			if (e.key === 'Enter') return inputElement.focus();
			if (e.key === 'Escape') return (input = '');
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	onDestroy(() => {
		if (audioContext) {
			audioContext.close();
		}
	});

	function updateVolume() {
		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(dataArray);

		// Calculate the average volume
		const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

		// Normalize the volume to a 0-100 scale
		volume = Math.round((average / 255) * 100);

		// Schedule the next update
		requestAnimationFrame(updateVolume);
	}

	async function submit(data) {
		isPending = true;
		const formData = new FormData();

		if (typeof data === 'string') {
			formData.append('input', data);
		} else {
			formData.append('input', data, 'audio.wav');
		}

		for (const message of messages) {
			formData.append('message', JSON.stringify(message));
		}

		const submittedAt = Date.now();
		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				body: formData
			});

			const transcript = decodeURIComponent(response.headers.get('X-Transcript') || '');
			const text = decodeURIComponent(response.headers.get('X-Response') || '');
			console.log('TEXT: ', text);
			if (!response.ok || !transcript || !text || !response.body) {
				if (response.status === 429) {
					toast.error('Too many requests. Please try again later.');
				} else {
					toast.error((await response.text()) || 'An error occurred.');
				}
				return;
			}

			const latency = Date.now() - submittedAt;

			player.play(response.body, () => {
				const isFirefox = navigator.userAgent.includes('Firefox');
				if (isFirefox) vad.start();
			});
			input = transcript;

			messages = [
				...messages,
				{ role: 'user', content: transcript },
				{ role: 'assistant', content: text, latency }
			];
		} finally {
			isPending = false;
		}
	}

	function handleFormSubmit(e) {
		e.preventDefault();
		submit(input);
	}
</script>

<div>
	<p class="mt-8 text-xs">
		Sage is an experimental application that aims to test long term relationships with users.
	</p>
	<div class="min-h-28 pb-4" />

	<form
		class="flex w-full max-w-3xl items-center rounded-full border border-transparent bg-neutral-200/80 focus-within:border-neutral-400 hover:border-neutral-300 hover:focus-within:border-neutral-400 dark:bg-neutral-800/80 dark:focus-within:border-neutral-600 dark:hover:border-neutral-700 dark:hover:focus-within:border-neutral-600"
		on:submit={handleFormSubmit}
	>
		<input
			type="text"
			class="w-full bg-transparent p-4 placeholder:text-neutral-600 focus:outline-none dark:placeholder:text-neutral-400"
			required
			placeholder=""
			bind:value={input}
			bind:this={inputElement}
		/>

		<button
			type="submit"
			class="p-4 text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
			disabled={isPending}
			aria-label="Submit"
		>
			{#if isPending}
				Loading
			{:else}
				Enter
			{/if}
		</button>
	</form>
	<!-- 	 -->
	<main>
		<h1>Microphone Volume Meter</h1>
		<p>Current volume: {volume}</p>
		<progress value={volume} max="100"></progress>
	</main>

	<div
		class="min-h-28 max-w-xl space-y-4 text-balance pt-4 text-center text-xs text-neutral-400 dark:text-neutral-600"
	>
		{#if messages.length > 0}
			<p>
				{messages[messages.length - 1].content}
				<span class="font-mono text-xs text-neutral-300 dark:text-neutral-700">
					({messages[messages.length - 1].latency}ms)
				</span>
			</p>
			<!-- {:else if vad.loading}
			<p>Loading speech detection...</p>
		{:else if vad.errored}
			<p>Failed to load speech detection.</p>
		{:else}
			<p>Start talking to chat.</p> -->
		{/if}
	</div>
</div>

<!-- <div
	class="absolute -z-50 size-36 rounded-full bg-gradient-to-b from-red-200 to-red-400 blur-3xl transition ease-in-out dark:from-red-600 dark:to-red-800"
	class:opacity-0={vad.loading || vad.errored}
	class:opacity-30={!vad.loading && !vad.errored && !vad.userSpeaking}
	class:opacity-100={vad.userSpeaking}
	class:scale-110={vad.userSpeaking}
/> -->
