import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';

export const getDb = (db: D1Database) => drizzle(db);
