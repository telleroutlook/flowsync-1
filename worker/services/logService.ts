import { observabilityLogs } from '../db/schema';
import { generateId, now } from './utils';

export const recordLog = async (
  db: ReturnType<typeof import('../db').getDb>,
  kind: 'ai_request' | 'ai_response' | 'tool_execution' | 'error',
  payload: Record<string, unknown>
) => {
  await db.insert(observabilityLogs).values({
    id: generateId(),
    kind,
    payload,
    createdAt: now(),
  });
};
