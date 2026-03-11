import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import prisma from '$lib/prisma';
import { apiKey } from '@better-auth/api-key';

export const auth = betterAuth({
	baseURL: env.ORIGIN || undefined,
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: 'sqlite'
	}),
	emailAndPassword: { enabled: true },
	plugins: [
		apiKey({
			// https://better-auth.com/docs/plugins/api-key/advanced#sessions-from-api-keys
			enableSessionForAPIKeys: true,
			// https://better-auth.com/docs/plugins/api-key/advanced#rate-limiting
			// 1000 req/min — generous enough for continuous polling (scriptlet polls every 3s)
			rateLimit: { enabled: true, window: 60000, max: 1000 }
		}),
		sveltekitCookies(getRequestEvent)
	] // make sure this is the last plugin in the array
});
