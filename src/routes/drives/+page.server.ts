import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
// import prisma client
import prisma from '$lib/prisma';
import { Prisma } from '$lib/../generated/prisma/client';

export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.session) {
			return fail(401, { message: 'Unauthorized' });
		}
		const data = await request.formData();

		const payload: Prisma.DriveCreateInput = {
			path: data.get('path') as string,
			backupPath: data.get('backupPath') as string,
			resticKey: data.get('resticKey') as string
		};
		console.log('Create Drive Payload', payload);
		await prisma.drive.create({ data: payload });
		throw redirect(303, '/drives'); // 303 is "See Other"
	}
} satisfies Actions;
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.session) {
		return fail(401, { message: 'Unauthorized' });
	}
	const drives = await prisma.drive.findMany({
		omit: {
			resticKey: true
		}
	});
	console.log('Loaded Drives', drives);
	return { drives };
};
