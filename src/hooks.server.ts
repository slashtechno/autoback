import type { Handle, ServerInit } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { watchPathsInBg } from '$lib/watcher';

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};


// Note: in Vite dev mode, hooks.server.ts is lazy-loaded on the first request,
// so init (and top-level code) both run on first request rather than true server start.
// In production (adapter-node/bun), init runs at true server startup.
export const init: ServerInit = async () => {
	try {
		await watchPathsInBg();
		console.log('Server initialized and watching paths');
	} catch (e) {
		console.error('Failed to start watcher:', e);
	}
};