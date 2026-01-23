import { Hono } from 'hono';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aiRoute } from './ai';

vi.mock('../services/logService', () => ({
  recordLog: vi.fn(),
}));

import { recordLog } from '../services/logService';

const mockDb = {};

const buildApp = () => {
  const app = new Hono<{ Variables: { db: any } }>();
  app.use('*', async (c, next) => {
    c.set('db', mockDb as any);
    await next();
  });
  app.route('/', aiRoute);
  return app;
};

const baseRequest = {
  history: [],
  message: 'Hello',
};

describe('aiRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when OPENAI_API_KEY is missing', async () => {
    const app = buildApp();
    const res = await app.request(
      '/api/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRequest),
      },
      { OPENAI_API_KEY: '' }
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error.code).toBe('MISSING_API_KEY');
  });

  it('returns model response with tool calls', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: 'Hi there',
                tool_calls: [
                  {
                    function: { name: 'listProjects', arguments: '{}' },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const app = buildApp();
    const res = await app.request(
      '/api/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRequest),
      },
      { OPENAI_API_KEY: 'test-key' }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.text).toBe('Hi there');
    expect(json.data.toolCalls).toHaveLength(1);
    expect(json.data.toolCalls[0].name).toBe('listProjects');
    expect(recordLog).toHaveBeenCalledTimes(2);
  });

  it('returns OPENAI_ERROR when upstream fails', async () => {
    const fetchMock = vi.fn(async () => new Response('Upstream error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const app = buildApp();
    const res = await app.request(
      '/api/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRequest),
      },
      { OPENAI_API_KEY: 'test-key' }
    );
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error.code).toBe('OPENAI_ERROR');
    expect(recordLog).toHaveBeenCalledTimes(1);
  });

  it('uses custom base URL and model when provided', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: { content: 'Custom', tool_calls: [] },
            },
          ],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const app = buildApp();
    const res = await app.request(
      '/api/ai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseRequest),
      },
      {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: 'https://example.com/v1/chat/completions///',
        OPENAI_MODEL: 'custom-model',
      }
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.text).toBe('Custom');
    expect(fetchMock).toHaveBeenCalled();

    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.com/v1/chat/completions');
    const body = JSON.parse(String(options.body));
    expect(body.model).toBe('custom-model');
  });
});
