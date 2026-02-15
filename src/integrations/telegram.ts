import type { PipelineResult, TelegramConfig } from '../types/index.js';

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;
  private threadId?: number;

  constructor(config: TelegramConfig) {
    this.botToken = process.env[config.bot_token_env] || '';
    this.chatId = config.chat_id;
    this.threadId = config.thread_id;
  }

  async send(message: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) return false;

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_thread_id: this.threadId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async notifyAgentComplete(agent: string, storyId: string, summary: string): Promise<void> {
    const msg = `*EqhoAIOS*\n\nAjan: \`${agent}\`\nStory: \`${storyId}\`\n\n${summary.slice(0, 500)}`;
    await this.send(msg);
  }

  async notifyPipelineComplete(result: PipelineResult): Promise<void> {
    const status = result.success ? 'Basarili' : 'Hata';
    const msg =
      `*EqhoAIOS Pipeline*\n\n` +
      `Story: \`${result.storyId}\`\n` +
      `Durum: ${status}\n` +
      `Faz: ${result.phase}\n` +
      `Token: ${result.totalTokensUsed}\n` +
      `Sure: ${result.totalDuration.toFixed(1)}s\n` +
      `Adimlar: ${result.steps.length}`;
    await this.send(msg);
  }
}
