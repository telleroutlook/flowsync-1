import { observabilityLogs } from '../db/schema';
import { generateId, now } from './utils';

export const recordLog = async (
  db: ReturnType<typeof import('../db').getDb>,
  kind: 'gemini_request' | 'gemini_response' | 'tool_execution' | 'error',
  payload: Record<string, unknown>
) => {
  await db.insert(observabilityLogs).values({
    id: generateId(),
    kind,
    payload: JSON.stringify(payload),
    createdAt: now(),
  });
};
