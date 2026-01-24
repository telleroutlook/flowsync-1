import type { DrizzleDB } from './db';

export type { DrizzleDB };

export type Variables = {
  db: DrizzleDB;
};

export type Bindings = {
  OPENAI_API_KEY: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
};
