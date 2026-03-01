import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import prisma from '$lib/prisma';

export const auth = betterAuth({
	baseURL: env.ORIGIN || undefined,
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prisma, {
		provider: 'sqlite'
	}),
	emailAndPassword: { enabled: true },
	plugins: [sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
});
