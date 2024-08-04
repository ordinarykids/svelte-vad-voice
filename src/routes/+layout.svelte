<script>
	import { inject } from '@vercel/analytics';
	import '../app.css';

	import { dev } from '$app/environment';

	inject({ mode: dev ? 'development' : 'production' });
</script>

<div class="container m-auto mt-16 w-3/4">
	<div class="m-auto w-1/4">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
			<rect x="3" y="0" width="1" height="1" fill="black" />
			<rect x="6" y="0" width="1" height="1" fill="black" />
			<rect x="2" y="1" width="1" height="1" fill="black" />
			<rect x="4" y="1" width="1" height="1" fill="black" />
			<rect x="5" y="1" width="1" height="1" fill="black" />
			<rect x="7" y="1" width="1" height="1" fill="black" />
			<rect x="1" y="2" width="1" height="1" fill="black" />
			<rect x="3" y="2" width="1" height="1" fill="black" />
			<rect x="6" y="2" width="1" height="1" fill="black" />
			<rect x="8" y="2" width="1" height="1" fill="black" />
			<rect x="2" y="3" width="1" height="1" fill="black" />
			<rect x="4" y="3" width="1" height="1" fill="black" />
			<rect x="5" y="3" width="1" height="1" fill="black" />
			<rect x="7" y="3" width="1" height="1" fill="black" />
			<rect x="3" y="4" width="1" height="1" fill="black" />
			<rect x="6" y="4" width="1" height="1" fill="black" />
			<rect x="4" y="5" width="1" height="1" fill="black" />
			<rect x="5" y="5" width="1" height="1" fill="black" />
			<rect x="4" y="6" width="1" height="1" fill="black" />
			<rect x="5" y="6" width="1" height="1" fill="black" />
			<rect x="4" y="7" width="1" height="1" fill="black" />
			<rect x="5" y="7" width="1" height="1" fill="black" />
			<rect x="4" y="8" width="1" height="1" fill="black" />
			<rect x="5" y="8" width="1" height="1" fill="black" />
			<rect x="4" y="9" width="1" height="1" fill="black" />
			<rect x="5" y="9" width="1" height="1" fill="black" />
		</svg>
	</div>
	<div class="m-auto w-1/2">
		<slot></slot>
	</div>
</div>
