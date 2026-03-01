import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '$env/dynamic/private';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
	url: env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

export default prisma;
