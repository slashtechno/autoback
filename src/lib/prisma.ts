import { PrismaClient } from '../generated/prisma/client.js';
import { DATABASE_URL } from '$env/static/private';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({
	url: DATABASE_URL
});

const prisma = new PrismaClient({
	adapter
});

export default prisma;
