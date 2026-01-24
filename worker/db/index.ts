// Re-export everything for convenience
export * from './schema';
export { getPgDb as getDb, closePgDb } from './pg';
import { getPgDb } from './pg';

export type DrizzleDB = ReturnType<typeof getPgDb>;
