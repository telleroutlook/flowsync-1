/**
 * BigModel (Zhipu AI) JWT Authentication
 *
 * Zhipu AI API key format: id.secret
 * Requires JWT signature to generate temporary token
 */

import { createHmac } from 'crypto';

export interface BigModelApiKey {
  id: string;
  secret: string;
}

/**
 * Parse Zhipu AI API key
 */
export function parseBigModelApiKey(apiKey: string): BigModelApiKey | null {
  const parts = apiKey.split('.');
  if (parts.length !== 2) {
    return null;
  }
  return { id: parts[0], secret: parts[1] };
}

/**
 * Generate Zhipu AI JWT token
 *
 * @param apiKey - Zhipu AI API key (format: id.secret)
 * @param expSeconds - Expiration time (seconds), default 3600 seconds (1 hour)
 */
export function generateBigModelToken(apiKey: string, expSeconds: number = 3600): string {
  const parsed = parseBigModelApiKey(apiKey);
  if (!parsed) {
    throw new Error('Invalid BigModel API key format. Expected: id.secret');
  }

  const { id, secret } = parsed;
  const now = Date.now();
  const exp = now + expSeconds * 1000;

  // JWT Header
  const header = {
    alg: 'HS256',
    sign_type: 'SIGN',
  };

  // JWT Payload
  const payload = {
    api_key: id,
    exp,
    timestamp: now,
  };

  // Base64Url encode (without padding)
  const base64UrlEncode = (str: string) => {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Signature
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${dataToSign}.${signature}`;
}

/**
 * Check if using Zhipu AI API
 */
export function isBigModelApi(baseUrl: string): boolean {
  return baseUrl.includes('bigmodel.cn');
}

/**
 * Get authorization header
 */
export function getAuthorizationHeader(apiKey: string, baseUrl: string): string {
  if (isBigModelApi(baseUrl)) {
    const token = generateBigModelToken(apiKey);
    return `Bearer ${token}`;
  }
  return `Bearer ${apiKey}`;
}
