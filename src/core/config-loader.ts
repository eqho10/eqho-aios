import { z } from 'zod';
import { readFile, fileExists, resolveProjectPath } from '../utils/file-utils.js';
import { parseYaml } from '../utils/yaml-utils.js';
import type { EqhoConfig } from '../types/index.js';

const AgentConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().optional(),
});

const ConfigSchema = z.object({
  project: z.object({
    name: z.string(),
    language: z.enum(['tr', 'en']).default('tr'),
    framework: z.string().optional(),
    description: z.string().optional(),
  }),
  llm: z.object({
    provider: z.enum(['anthropic', 'claude-cli']).default('claude-cli'),
    model: z.string().default('sonnet'),
    api_key_env: z.string().default('ANTHROPIC_API_KEY'),
    max_tokens: z.number().default(8192),
    temperature: z.number().default(0.3),
  }),
  agents: z.object({
    analyst: AgentConfigSchema.default({}),
    architect: AgentConfigSchema.default({}),
    developer: AgentConfigSchema.default({}),
    qa: AgentConfigSchema.default({}),
    scrum_master: AgentConfigSchema.default({}),
  }),
  orchestration: z.object({
    planning_agents: z.array(z.string()).default(['analyst', 'architect', 'scrum_master']),
    development_agents: z.array(z.string()).default(['scrum_master', 'developer', 'qa']),
    auto_approve: z.boolean().default(false),
    context_window: z.number().default(3),
    max_qa_retries: z.number().default(2),
  }),
  integrations: z.object({
    telegram: z.object({
      enabled: z.boolean().default(false),
      bot_token_env: z.string().default('TELEGRAM_BOT_TOKEN'),
      chat_id: z.string().default(''),
      thread_id: z.number().optional(),
    }).default({}),
    n8n: z.object({
      enabled: z.boolean().default(false),
      webhook_url: z.string().default(''),
    }).default({}),
    eqhomemory: z.object({
      enabled: z.boolean().default(false),
      server_url: z.string().default('http://100.91.162.51:7890'),
    }).default({}),
  }).default({}),
  paths: z.object({
    stories: z.string().default('docs/stories'),
    context: z.string().default('.eqho-aios/context'),
    history: z.string().default('.eqho-aios/history'),
    agents: z.string().optional(),
  }).default({}),
});

const CONFIG_PATH = '.eqho-aios/config.yaml';

export async function loadConfig(projectDir?: string): Promise<EqhoConfig> {
  const configPath = projectDir
    ? `${projectDir}/${CONFIG_PATH}`
    : resolveProjectPath(CONFIG_PATH);

  if (!(await fileExists(configPath))) {
    throw new Error(`Config bulunamadi: ${configPath}\n'eqho-aios init' komutu ile proje olusturun.`);
  }

  const raw = await readFile(configPath);
  const parsed = parseYaml<unknown>(raw);
  const validated = ConfigSchema.parse(parsed);

  // Validate API key exists in environment (only for anthropic provider)
  if (validated.llm.provider === 'anthropic') {
    const apiKey = process.env[validated.llm.api_key_env];
    if (!apiKey) {
      throw new Error(
        `API key bulunamadi: ${validated.llm.api_key_env} ortam degiskeni tanimli degil.\n` +
        `export ${validated.llm.api_key_env}=sk-ant-...\n` +
        `Alternatif: config.yaml'da provider: "claude-cli" olarak degistirin.`
      );
    }
  }

  return validated as EqhoConfig;
}

export function getApiKey(config: EqhoConfig): string {
  return process.env[config.llm.api_key_env] || '';
}
