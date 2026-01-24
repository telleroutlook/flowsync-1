export class AIService {
  async sendMessageStream(
    history: { role: string; parts: { text: string }[] }[],
    newMessage: string,
    systemContext: string | undefined,
    onEvent?: (event: string, data: Record<string, unknown>) => void
  ): Promise<{ text: string; toolCalls?: { name: string; args: unknown }[] }> {
    const STREAM_IDLE_TIMEOUT_MS = 120000;
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
    };
    resetTimeout();

    try {
      const response = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message: newMessage, systemContext }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || 'Streaming request failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let result: { text: string; toolCalls?: { name: string; args: unknown }[] } | null = null;

      const flushBuffer = (chunk: string) => {
        buffer += chunk;
        let boundaryIndex = buffer.indexOf('\n\n');
        while (boundaryIndex !== -1) {
          const rawEvent = buffer.slice(0, boundaryIndex);
          buffer = buffer.slice(boundaryIndex + 2);

          let eventName = 'message';
          let dataPayload = '';
          const lines = rawEvent.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataPayload += line.slice(5).trim();
            }
          }

          if (!dataPayload) {
            boundaryIndex = buffer.indexOf('\n\n');
            continue;
          }

          const parsed = (() => {
            try {
              return JSON.parse(dataPayload) as Record<string, unknown>;
            } catch {
              return { raw: dataPayload };
            }
          })();

          onEvent?.(eventName, parsed);

          if (eventName === 'result') {
            result = parsed as unknown as { text: string; toolCalls?: { name: string; args: unknown }[] };
          }

          if (eventName === 'error') {
            const message = typeof parsed.message === 'string' ? parsed.message : 'Streaming error';
            throw new Error(message);
          }

          boundaryIndex = buffer.indexOf('\n\n');
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetTimeout();
        flushBuffer(decoder.decode(value, { stream: true }));
      }

      if (!result) {
        throw new Error('No streaming result received.');
      }

      return result;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Streaming request timed out.');
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async sendMessage(
    history: { role: string; parts: { text: string }[] }[],
    newMessage: string,
    systemContext?: string
  ): Promise<{ text: string; toolCalls?: { name: string; args: unknown }[] }> {
    try {
      const REQUEST_TIMEOUT_MS = 180000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message: newMessage, systemContext }),
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      const payload: {
        success: boolean;
        data?: { text: string; toolCalls?: { name: string; args: unknown }[] };
        error?: { code: string; message: string };
      } | null = await response.json().catch(() => null);

      if (!response.ok || !payload?.success || !payload?.data) {
        return { text: payload?.error?.message || 'Sorry, I encountered an error processing your request.' };
      }

      return payload.data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn('AI API timeout:', error);
        return { text: '请求超时，请稍后重试。' };
      }
      console.error("AI API Error:", error);
      return { text: "Sorry, I encountered an error processing your request." };
    }
  }
}

export const aiService = new AIService();
