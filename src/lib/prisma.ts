import { PrismaClient } from '../generated/prisma/client.js';
import { DATABASE_URL } from '$env/static/private';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const adapter = new PrismaLibSql({
	url: DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

export default prisma;
