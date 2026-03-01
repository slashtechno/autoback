import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		// Disable SvelteKit's built-in CSRF origin check. This app is self-hosted
		// and may be accessed from any hostname/IP on the LAN, making a fixed
		// origin comparison unreliable. Better Auth provides its own auth security.
		csrf: { checkOrigin: false },
		experimental: {
			remoteFunctions: true
		}
	},
	compilerOptions: {
		experimental: {
			// async: true
		}
	}	
};

export default config;
