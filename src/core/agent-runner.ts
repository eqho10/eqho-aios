import ora from 'ora';
import { ClaudeClient } from '../llm/claude-client.js';
import { buildSystemPrompt, buildUserMessage } from '../llm/prompt-builder.js';
import { formatCost } from '../llm/token-counter.js';
import { loadProjectContext, loadTechStack, getRelevantSteps } from './context.js';
import { log } from '../utils/logger.js';
import type {
  AgentPrompt,
  Story,
  EqhoConfig,
  PipelineStep,
} from '../types/index.js';

/**
 * Executes a single agent against a story and returns a PipelineStep
 * with the agent's output, token usage, and duration.
 */
export async function runAgent(
  agent: AgentPrompt,
  story: Story,
  config: EqhoConfig,
  previousSteps: PipelineStep[]
): Promise<PipelineStep> {
  const startTime = Date.now();

  log.agent(agent.name, `${agent.displayName} calisiyor...`);

  // Load project context and tech stack
  const [projectContext, techStack] = await Promise.all([
    loadProjectContext(config).catch(() => undefined),
    loadTechStack(config).catch(() => undefined),
  ]);

  // Build prompts
  const systemPrompt = buildSystemPrompt(agent, projectContext, techStack);

  const relevantSteps = getRelevantSteps(
    previousSteps,
    config.orchestration.context_window
  );
  const userMessage = buildUserMessage(story, relevantSteps);

  // Determine model override for this agent
  const agentConfig = config.agents[agent.name];
  const model = agentConfig?.model ?? undefined;

  // Execute with spinner
  const spinner = ora({
    text: `@${agent.name} dusunuyor...`,
    color: 'magenta',
  }).start();

  try {
    const client = new ClaudeClient(config.llm);
    const response = await client.execute(systemPrompt, userMessage, { model });

    spinner.succeed(`@${agent.name} tamamlandi`);

    // Log token usage and cost
    log.tokens(response.inputTokens, response.outputTokens);
    const cost = formatCost(response.inputTokens, response.outputTokens, response.model);
    log.info(`  maliyet: ~${cost}`);

    if (response.stopReason && response.stopReason !== 'end_turn') {
      log.warn(`  stop_reason: ${response.stopReason}`);
    }

    const duration = Date.now() - startTime;

    return {
      agent: agent.name,
      input: userMessage,
      output: response.content,
      tokensUsed: response.inputTokens + response.outputTokens,
      duration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    spinner.fail(`@${agent.name} basarisiz`);

    const message = error instanceof Error ? error.message : String(error);
    log.error(`Agent hatasi (${agent.name}): ${message}`);

    const duration = Date.now() - startTime;

    return {
      agent: agent.name,
      input: userMessage,
      output: `HATA: ${message}`,
      tokensUsed: 0,
      duration,
      timestamp: new Date().toISOString(),
    };
  }
}
