export class AIService {
  async sendMessage(
    history: { role: string; parts: { text: string }[] }[],
    newMessage: string,
    systemContext?: string
  ): Promise<{ text: string; toolCalls?: { name: string; args: unknown }[] }> {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, message: newMessage, systemContext }),
      });

      const payload: {
        success: boolean;
        data?: { text: string; toolCalls?: { name: string; args: unknown }[] };
        error?: { code: string; message: string };
      } = await response.json();

      if (!response.ok || !payload.success || !payload.data) {
        return { text: payload.error?.message || 'Sorry, I encountered an error processing your request.' };
      }

      return payload.data;
    } catch (error) {
      console.error("AI API Error:", error);
      return { text: "Sorry, I encountered an error processing your request." };
    }
  }
}

export const aiService = new AIService();
