import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, AgentResponse } from '../types/index.js';
import { log } from '../utils/logger.js';

export class ClaudeClient {
  private client: Anthropic;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: LLMConfig) {
    const apiKey = process.env[config.api_key_env];

    if (!apiKey) {
      throw new Error(
        `API key bulunamadi: ${config.api_key_env} ortam degiskeni tanimli degil.\n` +
        `export ${config.api_key_env}=sk-ant-...`
      );
    }

    this.client = new Anthropic({ apiKey });
    this.defaultModel = config.model;
    this.defaultMaxTokens = config.max_tokens;
    this.defaultTemperature = config.temperature ?? 0.3;
  }

  async execute(
    systemPrompt: string,
    userMessage: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<AgentResponse> {
    const model = options?.model ?? this.defaultModel;
    const maxTokens = options?.maxTokens ?? this.defaultMaxTokens;
    const temperature = options?.temperature ?? this.defaultTemperature;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return {
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
        stopReason: response.stop_reason,
      };
    } catch (error: unknown) {
      if (error instanceof Anthropic.RateLimitError) {
        log.error('API rate limit asildi. Lutfen biraz bekleyin.');
        throw new Error('Rate limit exceeded. Please wait before retrying.');
      }

      if (error instanceof Anthropic.AuthenticationError) {
        log.error('API kimlik dogrulama hatasi. API anahtarinizi kontrol edin.');
        throw new Error('Authentication failed. Check your API key.');
      }

      if (error instanceof Anthropic.APIConnectionError) {
        log.error('API baglanti hatasi. Internet baglantinizi kontrol edin.');
        throw new Error('Connection failed. Check your internet connection.');
      }

      if (error instanceof Anthropic.APIError) {
        log.error(`API hatasi (${error.status}): ${error.message}`);
        throw new Error(`API error (${error.status}): ${error.message}`);
      }

      // Unknown error
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Beklenmeyen hata: ${message}`);
      throw new Error(`Unexpected error: ${message}`);
    }
  }
}
