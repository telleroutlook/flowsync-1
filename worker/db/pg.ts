import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export const getPgDb = () => {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString });
    db = drizzle(pool);
  }
  return db;
};

export const closePgDb = async () => {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
};
