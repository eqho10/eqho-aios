export type AgentName = 'analyst' | 'architect' | 'developer' | 'qa' | 'scrum_master';

export type StoryStatus = 'draft' | 'planning' | 'ready' | 'in_progress' | 'review' | 'done';
export type StoryPriority = 'critical' | 'high' | 'medium' | 'low';
export type PipelinePhase = 'planning' | 'development' | 'full';

// Config types
export interface ProjectConfig {
  name: string;
  language: 'tr' | 'en';
  framework?: string;
  description?: string;
}

export interface LLMConfig {
  provider: 'anthropic';
  model: string;
  api_key_env: string;
  max_tokens: number;
  temperature?: number;
}

export interface AgentConfig {
  enabled: boolean;
  model?: string;
}

export interface OrchestrationConfig {
  planning_agents: AgentName[];
  development_agents: AgentName[];
  auto_approve: boolean;
  context_window: number;
  max_qa_retries?: number;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token_env: string;
  chat_id: string;
  thread_id?: number;
}

export interface N8nConfig {
  enabled: boolean;
  webhook_url: string;
}

export interface EqhoMemoryConfig {
  enabled: boolean;
  server_url: string;
}

export interface IntegrationsConfig {
  telegram: TelegramConfig;
  n8n: N8nConfig;
  eqhomemory: EqhoMemoryConfig;
}

export interface PathsConfig {
  stories: string;
  context: string;
  history: string;
  agents?: string;
}

export interface EqhoConfig {
  project: ProjectConfig;
  llm: LLMConfig;
  agents: Record<AgentName, AgentConfig>;
  orchestration: OrchestrationConfig;
  integrations: IntegrationsConfig;
  paths: PathsConfig;
}

// Agent types
export interface AgentPrompt {
  name: AgentName;
  displayName: string;
  description: string;
  phase: 'planning' | 'development' | 'both';
  order: number;
  identity: string;
  capabilities: string[];
  commands: string[];
  scope: string[];
  rules: string[];
  outputFormat: string;
  rawContent: string;
}

// Story types
export interface StoryFrontmatter {
  id: string;
  title: string;
  status: StoryStatus;
  priority: StoryPriority;
  phase: string;
  current_agent: AgentName | null;
  agents_completed: AgentName[];
  created: string;
  updated?: string;
  tags?: string[];
  estimated_tokens?: number;
  actual_tokens?: number;
}

export interface Story {
  frontmatter: StoryFrontmatter;
  body: string;
  sections: Record<string, string>;
  filePath: string;
}

// Pipeline types
export interface PipelineStep {
  agent: AgentName;
  input: string;
  output: string;
  tokensUsed: number;
  duration: number;
  timestamp: string;
}

export interface PipelineResult {
  storyId: string;
  phase: PipelinePhase;
  steps: PipelineStep[];
  totalTokensUsed: number;
  totalDuration: number;
  success: boolean;
  error?: string;
}

export interface AgentResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: string | null;
}
