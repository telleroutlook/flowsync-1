// Re-export everything for convenience
export * from './schema';
export { getPgDb as getDb, closePgDb } from './pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type DrizzleDB = NodePgDatabase<typeof schema>;
