import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { REGISTRATION_TOKEN } from '$env/static/private';

type loginOrRegisterPayload = {
	email: string;
	password: string;
};

export const actions = {
	login: async ({ request }) => {
		const data = await request.formData();

		const payload: loginOrRegisterPayload = {
			email: data.get('email') as string,
			password: data.get('password') as string
		};
		console.log('Login/Register Payload', payload);

		try {
			if (REGISTRATION_TOKEN && data.get('registrationToken') === REGISTRATION_TOKEN) {
				console.log('Registration token is valid, proceeding with sign up');
			} else {
				console.log(
					'No valid registration token provided, attempting to log in instead of signing up'
				);
				throw new Error('GO_TO_LOGIN_INSTEAD');
			}
			const signUpResponse = await auth.api.signUpEmail({
				body: {
					email: payload.email, // required
					password: payload.password, // required
					name: payload.email.split('@')[0]
				}
			});
			console.log('Sign Up Response', signUpResponse);
		} catch (error) {
			if (
				(error instanceof Error && error.message === 'GO_TO_LOGIN_INSTEAD') ||
				(error as any).body?.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'
			) {
				// login instead of signing up
				try {
					const signInResponse = await auth.api.signInEmail({
						body: {
							email: payload.email, // required
							password: payload.password, // required
							rememberMe: true
							// callbackURL: 'https://example.com/callback'
						},
						headers: request.headers
					});
					// console.log('Sign In Response', signInResponse);
				} catch (error) {
					console.error('Error during sign in:', error);
					return fail(500, { message: 'An error occurred during sign in.' });
				}
			} else if (error instanceof Error) {
				console.error('Error during sign up:', error.message);
				return fail(500, { message: 'An error occurred during sign up.' });
			}
		}
		throw redirect(303, '/');
	}
} satisfies Actions;
export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		throw redirect(303, '/');
	}
};
