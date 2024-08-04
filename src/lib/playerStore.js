import { writable } from 'svelte/store';

function createPlayerStore() {
	const { subscribe, set } = writable(false);
	let audioContext = null;
	let source = null;

	async function play(stream, callback) {
		stop();
		audioContext = null;
		audioContext = new AudioContext({ sampleRate: 24000 });

		let nextStartTime = audioContext.currentTime;
		const reader = stream.getReader();
		let leftover = new Uint8Array();
		let result = await reader.read();
		set(true);

		while (!result.done && audioContext) {
			const data = new Uint8Array(leftover.length + result.value.length);
			data.set(leftover);
			data.set(result.value, leftover.length);

			const length = Math.floor(data.length / 4) * 4;
			const remainder = data.length % 4;
			const buffer = new Float32Array(data.buffer, 0, length / 4);

			leftover = new Uint8Array(data.buffer, length, remainder);

			const audioBuffer = audioContext.createBuffer(1, buffer.length, audioContext.sampleRate);
			audioBuffer.copyToChannel(buffer, 0);

			source = audioContext.createBufferSource();
			source.buffer = audioBuffer;
			source.connect(audioContext.destination);
			source.start(nextStartTime);

			nextStartTime += audioBuffer.duration;

			result = await reader.read();
			if (result.done) {
				source.onended = () => {
					stop();
					callback();
				};
			}
		}
	}

	function stop() {
		if (audioContext) {
			audioContext.close();
			audioContext = null;
		}
		set(false);
		console.log('Player Stopped');
	}

	return {
		subscribe,
		play,
		stop
	};
}

export const playerStore = createPlayerStore();
