import type { N8nConfig } from '../types/index.js';

export class N8nWebhook {
  private webhookUrl: string;

  constructor(config: N8nConfig) {
    this.webhookUrl = config.webhook_url;
  }

  async send(data: {
    event: 'agent_complete' | 'pipeline_complete' | 'story_created';
    storyId: string;
    agent?: string;
    result?: string;
    tokens?: number;
    success?: boolean;
    timestamp: string;
  }): Promise<boolean> {
    if (!this.webhookUrl) return false;

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
