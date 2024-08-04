import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	csp: {
		mode: 'auto',
		directives: {
			'cross-origin-opener-policy': ['same-origin'],
			'cross-origin-embedder-policy': ['require-corp']
		}
	}
});
