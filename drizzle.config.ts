import type { Config } from 'drizzle-kit';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID ?? '376955eb-a3f2-48c0-a8f2-056be5b1c9ea';

if (!accountId || !apiToken) {
  throw new Error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN for drizzle-kit.');
}

export default {
  schema: './worker/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId,
    databaseId,
    token: apiToken,
  },
} satisfies Config;
