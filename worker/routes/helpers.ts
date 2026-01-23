import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const jsonOk = (c: Context, data: unknown, status = 200) =>
  c.json({ success: true, data }, status as ContentfulStatusCode);

export const jsonError = (
  c: Context,
  code: string,
  message: string,
  status = 400
) => c.json({ success: false, error: { code, message } }, status as ContentfulStatusCode);
