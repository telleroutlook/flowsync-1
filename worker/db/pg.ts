import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

type VcapServiceCredential = {
  uri?: string;
  url?: string;
  jdbcUrl?: string;
  hostname?: string;
  host?: string;
  port?: number;
  username?: string;
  user?: string;
  password?: string;
  database?: string;
  dbname?: string;
};

type VcapServices = Record<string, Array<{ credentials?: VcapServiceCredential }>>;

const buildConnectionStringFromCredentials = (cred: VcapServiceCredential) => {
  const user = cred.username || cred.user;
  const password = cred.password;
  const host = cred.hostname || cred.host;
  const port = cred.port;
  const database = cred.database || cred.dbname;
  if (!user || !password || !host || !database) {
    return null;
  }
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  const portPart = port ? `:${port}` : '';
  return `postgres://${encodedUser}:${encodedPassword}@${host}${portPart}/${database}`;
};

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) {
    return null;
  }

  try {
    const parsed = JSON.parse(vcap) as VcapServices;
    const services = Object.values(parsed).flat();
    for (const service of services) {
      const cred = service.credentials;
      if (!cred) continue;
      if (cred.uri) return cred.uri;
      if (cred.url) return cred.url;
      if (cred.jdbcUrl) return cred.jdbcUrl.replace(/^jdbc:/, '');
      const constructed = buildConnectionStringFromCredentials(cred);
      if (constructed) return constructed;
    }
  } catch (error) {
    // Silently fail on VCAP_SERVICES parse error
  }

  return null;
};

export const getPgDb = () => {
  if (!db) {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set and VCAP_SERVICES does not contain PostgreSQL credentials');
    }
    const useSsl =
      !!process.env.VCAP_SERVICES &&
      process.env.PGSSLMODE !== 'disable' &&
      process.env.PGSSLMODE !== 'allow';
    pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
    db = drizzle(pool, { schema });
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
