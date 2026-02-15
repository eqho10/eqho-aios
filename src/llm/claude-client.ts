import { spawn } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, AgentResponse } from '../types/index.js';
import { log } from '../utils/logger.js';
import { estimateTokens } from './token-counter.js';

/**
 * Claude CLI backend - uses `claude --print` command with stdin pipe.
 * No API key needed, uses existing Claude subscription.
 */
async function executeViaCLI(
  systemPrompt: string,
  userMessage: string,
  model?: string,
): Promise<AgentResponse> {
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userMessage}`;

  const args = ['--print', '--model', model ?? 'sonnet', '--dangerously-skip-permissions', '-p', '-'];

  // Remove CLAUDECODE env to allow nested invocation
  const env = { ...process.env };
  delete env.CLAUDECODE;

  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('error', (err) => {
      if (err.message.includes('ENOENT')) {
        reject(new Error(
          'Claude CLI bulunamadi. Claude Code kurulu oldugundan emin olun:\n' +
          'npm install -g @anthropic-ai/claude-code'
        ));
      } else {
        reject(new Error(`Claude CLI hatasi: ${err.message}`));
      }
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI hata kodu ${code}: ${stderr.trim() || 'bilinmeyen hata'}`));
        return;
      }

      const content = stdout.trim();
      const inputEst = estimateTokens(fullPrompt);
      const outputEst = estimateTokens(content);

      resolve({
        content,
        inputTokens: inputEst,
        outputTokens: outputEst,
        model: model ?? 'sonnet',
        stopReason: 'end_turn',
      });
    });

    // Set timeout
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude CLI zaman asimina ugradi (5 dakika).'));
    }, 300_000);

    child.on('close', () => clearTimeout(timer));

    // Write prompt to stdin and close
    child.stdin.write(fullPrompt);
    child.stdin.end();
  });
}

/**
 * Anthropic API backend - uses SDK directly.
 * Requires ANTHROPIC_API_KEY environment variable.
 */
async function executeViaAPI(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxTokens: number,
  temperature: number,
): Promise<AgentResponse> {
  const response = await client.messages.create({
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
}

export class ClaudeClient {
  private client: Anthropic | null = null;
  private provider: 'anthropic' | 'claude-cli';
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(config: LLMConfig) {
    this.provider = config.provider ?? 'claude-cli';
    this.defaultModel = config.model;
    this.defaultMaxTokens = config.max_tokens;
    this.defaultTemperature = config.temperature ?? 0.3;

    if (this.provider === 'anthropic') {
      const apiKey = process.env[config.api_key_env];
      if (!apiKey) {
        throw new Error(
          `API key bulunamadi: ${config.api_key_env} ortam degiskeni tanimli degil.\n` +
          `export ${config.api_key_env}=sk-ant-...\n` +
          `Alternatif: config.yaml'da provider: "claude-cli" olarak degistirin.`
        );
      }
      this.client = new Anthropic({ apiKey });
    } else {
      log.info('Claude CLI backend kullaniliyor (claude --print)');
    }
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
      if (this.provider === 'claude-cli') {
        return await executeViaCLI(systemPrompt, userMessage, model);
      }

      // Anthropic API path
      return await executeViaAPI(
        this.client!,
        systemPrompt,
        userMessage,
        model,
        maxTokens,
        temperature,
      );
    } catch (error: unknown) {
      if (this.provider === 'anthropic') {
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
      }

      const message = error instanceof Error ? error.message : String(error);
      log.error(`Beklenmeyen hata: ${message}`);
      throw error;
    }
  }
}
