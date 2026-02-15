import ora from 'ora';
import { loadAgent } from './agent-loader.js';
import { runAgent } from './agent-runner.js';
import { loadStory } from './story-parser.js';
import { updateStoryFrontmatter, appendAgentOutput } from './story-writer.js';
import { log } from '../utils/logger.js';
import type {
  EqhoConfig,
  AgentName,
  Story,
  PipelineResult,
  PipelineStep,
  PipelinePhase,
} from '../types/index.js';

interface OrchestratorOptions {
  phase: PipelinePhase;
  autoApprove: boolean;
  singleAgent?: AgentName;
}

export class Orchestrator {
  constructor(private config: EqhoConfig) {}

  async run(storyId: string, options: OrchestratorOptions): Promise<PipelineResult> {
    let story = await loadStory(storyId, this.config);
    log.title(`EqhoAIOS Pipeline: ${story.frontmatter.id}`);
    log.info(`Story: ${story.frontmatter.title}`);
    log.info(`Faz: ${options.phase}`);
    log.divider();

    const startTime = Date.now();
    const allSteps: PipelineStep[] = [];
    let success = true;
    let error: string | undefined;

    try {
      if (options.singleAgent) {
        // Run single agent
        const step = await this.runSingleAgent(story, options.singleAgent, allSteps);
        allSteps.push(step);
        story = await appendAgentOutput(story, options.singleAgent, step.output);
      } else if (options.phase === 'planning' || options.phase === 'full') {
        // Planning phase
        const planResult = await this.runPhase(
          story,
          this.config.orchestration.planning_agents as AgentName[],
          'planning',
          options.autoApprove,
          allSteps
        );
        story = planResult.story;
        allSteps.push(...planResult.steps);

        if (!planResult.success) {
          success = false;
          error = 'Planlama fazinda hata olustu';
        }
      }

      if (success && (options.phase === 'development' || options.phase === 'full')) {
        // Development phase
        const devResult = await this.runPhase(
          story,
          this.config.orchestration.development_agents as AgentName[],
          'development',
          options.autoApprove,
          allSteps
        );
        story = devResult.story;
        allSteps.push(...devResult.steps);

        if (!devResult.success) {
          success = false;
          error = 'Gelistirme fazinda hata olustu';
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      log.error(`Pipeline hatasi: ${error}`);
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    const totalTokensUsed = allSteps.reduce((sum, s) => sum + s.tokensUsed, 0);

    // Update story status
    const finalStatus = success ? 'done' : story.frontmatter.status;
    await updateStoryFrontmatter(story, {
      status: finalStatus,
      actual_tokens: (story.frontmatter.actual_tokens || 0) + totalTokensUsed,
    });

    // Summary
    log.divider();
    log.title('Pipeline Tamamlandi');
    log.info(`Durum: ${success ? 'Basarili' : 'Hata'}`);
    log.info(`Sure: ${totalDuration.toFixed(1)}s`);
    log.tokens(
      allSteps.reduce((s, step) => s + step.tokensUsed, 0),
      allSteps.reduce((s, step) => s + step.tokensUsed, 0)
    );
    log.info(`Adim sayisi: ${allSteps.length}`);

    return {
      storyId,
      phase: options.phase,
      steps: allSteps,
      totalTokensUsed,
      totalDuration,
      success,
      error,
    };
  }

  private async runPhase(
    story: Story,
    agents: AgentName[],
    phase: string,
    autoApprove: boolean,
    previousSteps: PipelineStep[]
  ): Promise<{ story: Story; steps: PipelineStep[]; success: boolean }> {
    log.title(`Faz: ${phase === 'planning' ? 'Planlama' : 'Gelistirme'}`);
    const steps: PipelineStep[] = [];
    let currentStory = story;
    let qaRetries = 0;
    const maxRetries = this.config.orchestration.max_qa_retries || 2;

    for (let i = 0; i < agents.length; i++) {
      const agentName = agents[i];
      log.step(i + 1, agents.length, `@${agentName} calisiyor...`);

      // Update story current agent
      currentStory = await updateStoryFrontmatter(currentStory, {
        current_agent: agentName,
        status: phase === 'planning' ? 'planning' : 'in_progress',
      });

      // Run agent
      const step = await this.runSingleAgent(
        currentStory,
        agentName,
        [...previousSteps, ...steps]
      );
      steps.push(step);

      // Append output to story
      currentStory = await appendAgentOutput(currentStory, agentName, step.output);
      log.success(`@${agentName} tamamlandi`);
      log.tokens(step.tokensUsed, step.tokensUsed);

      // QA feedback loop
      if (agentName === 'qa' && step.output.includes('DUZELTME_GEREK')) {
        if (qaRetries < maxRetries) {
          qaRetries++;
          log.warn(`QA duzeltme istedi (deneme ${qaRetries}/${maxRetries})`);
          // Re-run developer with QA feedback
          const devIndex = agents.indexOf('developer');
          if (devIndex !== -1) {
            i = devIndex - 1; // Will be incremented by loop
            continue;
          }
        } else {
          log.warn('Maksimum QA deneme sayisina ulasildi');
        }
      }

      // Human confirmation (if not auto-approve)
      if (!autoApprove && i < agents.length - 1) {
        const { default: inquirer } = await import('inquirer');
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Sonraki ajana gecisin mi?',
            default: true,
          },
        ]);
        if (!proceed) {
          log.warn('Pipeline kullanici tarafindan durduruldu');
          return { story: currentStory, steps, success: false };
        }
      }
    }

    return { story: currentStory, steps, success: true };
  }

  private async runSingleAgent(
    story: Story,
    agentName: AgentName,
    previousSteps: PipelineStep[]
  ): Promise<PipelineStep> {
    const agent = await loadAgent(agentName, this.config);
    const spinner = ora({
      text: `${agent.displayName} calisiyor...`,
      color: 'magenta',
    }).start();

    try {
      const step = await runAgent(agent, story, this.config, previousSteps);
      spinner.succeed(`${agent.displayName} tamamlandi`);
      return step;
    } catch (err) {
      spinner.fail(`${agent.displayName} hata verdi`);
      throw err;
    }
  }
}
