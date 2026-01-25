import { and, eq, gt } from 'drizzle-orm';
import { sessions, users } from '../db/schema';
import { generateId, now } from './utils';
import type { UserRecord } from './types';

const PASSWORD_ITERATIONS = 120_000;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const encoder = new TextEncoder();

const assertCrypto = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Crypto API unavailable.');
  }
};

const toBase64 = (bytes: Uint8Array) => {
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
};

const fromBase64 = (value: string) => {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(value, 'base64'));
};

const derivePasswordHash = async (password: string, salt: Uint8Array, iterations: number) => {
  assertCrypto();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    HASH_BYTES * 8
  );
  return new Uint8Array(derivedBits);
};

export const hashPassword = async (password: string) => {
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
};

export const verifyPassword = async (password: string, stored: string) => {
  const [scheme, iterationsRaw, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !saltB64 || !hashB64) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(saltB64);
  const derived = await derivePasswordHash(password, salt, iterations);
  const expected = fromBase64(hashB64);
  if (expected.length !== derived.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected[i] ^ derived[i];
  }
  return mismatch === 0;
};

export const hashToken = async (token: string) => {
  assertCrypto();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return toBase64(new Uint8Array(digest));
};

export const createUser = async (
  db: ReturnType<typeof import('../db').getDb>,
  input: { username: string; password: string }
): Promise<UserRecord> => {
  const passwordHash = await hashPassword(input.password);
  const record: UserRecord = {
    id: generateId(),
    username: input.username,
    createdAt: now(),
  };
  await db.insert(users).values({
    id: record.id,
    username: record.username,
    passwordHash,
    createdAt: record.createdAt,
  });
  return record;
};

export const getUserByUsername = async (
  db: ReturnType<typeof import('../db').getDb>,
  username: string
): Promise<{ user: UserRecord; passwordHash: string } | null> => {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    user: { id: row.id, username: row.username, createdAt: row.createdAt },
    passwordHash: row.passwordHash,
  };
};

export const createSession = async (
  db: ReturnType<typeof import('../db').getDb>,
  userId: string
): Promise<{ token: string; expiresAt: number }> => {
  const token = crypto.randomUUID();
  const tokenHash = await hashToken(token);
  const timestamp = now();
  const expiresAt = timestamp + SESSION_TTL_MS;
  await db.insert(sessions).values({
    id: generateId(),
    userId,
    tokenHash,
    createdAt: timestamp,
    expiresAt,
  });
  return { token, expiresAt };
};

export const getUserFromToken = async (
  db: ReturnType<typeof import('../db').getDb>,
  token: string
): Promise<UserRecord | null> => {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      createdAt: users.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, createdAt: row.createdAt };
};

export const revokeSession = async (
  db: ReturnType<typeof import('../db').getDb>,
  token: string
) => {
  if (!token) return;
  const tokenHash = await hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
};

export const parseAuthHeader = (value: string | undefined | null) => {
  if (!value) return null;
  const [type, token] = value.split(' ');
  if (!token || type.toLowerCase() !== 'bearer') return null;
  return token.trim();
};

export const getSessionExpiry = () => SESSION_TTL_MS;
