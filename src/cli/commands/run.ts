import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import path from 'path';
import matter from 'gray-matter';
import { log } from '../../utils/logger.js';
import { loadConfig } from '../../core/config-loader.js';
import { Orchestrator } from '../../core/orchestrator.js';
import {
  readFile,
  fileExists,
  listFiles,
  resolveProjectPath,
} from '../../utils/file-utils.js';
import type {
  Story,
  StoryFrontmatter,
  PipelinePhase,
  AgentName,
} from '../../types/index.js';

async function findStoryById(storyId: string, storiesDir: string): Promise<Story | null> {
  const files = await listFiles(storiesDir, '.md');

  for (const file of files) {
    if (file.startsWith('_')) continue;
    const filePath = path.join(storiesDir, file);
    const content = await readFile(filePath);
    const { data, content: body } = matter(content);
    const frontmatter = data as StoryFrontmatter;

    if (frontmatter.id === storyId) {
      // Parse sections from body
      const sections: Record<string, string> = {};
      const sectionRegex = /^## (.+)$/gm;
      let match: RegExpExecArray | null;
      const matches: Array<{ title: string; index: number }> = [];

      while ((match = sectionRegex.exec(body)) !== null) {
        matches.push({ title: match[1], index: match.index + match[0].length });
      }

      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i + 1 < matches.length ? matches[i + 1].index - matches[i + 1].title.length - 3 : body.length;
        sections[matches[i].title.trim()] = body.slice(start, end).trim();
      }

      return { frontmatter, body, sections, filePath };
    }
  }

  return null;
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .argument('<story-id>', 'Story ID (e.g., EQHO-001)')
    .option('--phase <phase>', 'Pipeline phase: planning, development, or full', 'full')
    .option('--auto', 'Auto-approve all agent outputs', false)
    .option('--agent <name>', 'Run a single agent against the story')
    .description('Run the AI pipeline on a story')
    .action(async (storyId: string, options: { phase: string; auto: boolean; agent?: string }) => {
      try {
        log.title('EqhoAIOS - Pipeline Calistir');

        // Load config
        const spinner = ora('Konfigurasyon yukleniyor...').start();
        const config = await loadConfig();
        spinner.succeed('Konfigurasyon yuklendi');

        // Find story
        const storiesDir = resolveProjectPath(config.paths.stories);
        if (!(await fileExists(storiesDir))) {
          log.error(`Stories dizini bulunamadi: ${storiesDir}`);
          log.info("Once 'eqho-aios init' komutunu calistirin.");
          process.exit(1);
        }

        const storySpinner = ora(`Story yukleniyor: ${storyId}`).start();
        const story = await findStoryById(storyId, storiesDir);

        if (!story) {
          storySpinner.fail(`Story bulunamadi: ${storyId}`);
          log.info('Mevcut storyleri gormek icin: eqho-aios story list');
          process.exit(1);
        }

        storySpinner.succeed(`Story yuklendi: ${story.frontmatter.title}`);

        // Display story info
        log.divider();
        console.log(chalk.gray('  ID:      ') + chalk.white(story.frontmatter.id));
        console.log(chalk.gray('  Baslik:  ') + chalk.white(story.frontmatter.title));
        console.log(chalk.gray('  Durum:   ') + chalk.yellow(story.frontmatter.status));
        console.log(chalk.gray('  Oncelik: ') + chalk.cyan(story.frontmatter.priority));
        log.divider();

        const phase = options.phase as PipelinePhase;

        // Create orchestrator
        const orchestrator = new Orchestrator(config);

        // Single agent mode
        if (options.agent) {
          const agentName = options.agent as AgentName;
          const validAgents: AgentName[] = ['analyst', 'architect', 'developer', 'qa', 'scrum_master'];

          if (!validAgents.includes(agentName)) {
            log.error(`Gecersiz agent: ${agentName}`);
            log.info(`Gecerli agentlar: ${validAgents.join(', ')}`);
            process.exit(1);
          }

          if (!config.agents[agentName]?.enabled) {
            log.error(`Agent devre disi: ${agentName}`);
            process.exit(1);
          }

          log.info(`Tek agent modu: @${agentName}`);

          try {
            const result = await orchestrator.run(storyId, {
              phase,
              autoApprove: options.auto,
              singleAgent: agentName,
            });

            log.divider();
            if (result.success) {
              log.success(`@${agentName} tamamlandi`);
              log.tokens(result.totalTokensUsed, result.totalTokensUsed);
            } else {
              log.error(`@${agentName} hata verdi: ${result.error || 'Bilinmeyen hata'}`);
              process.exit(1);
            }
          } catch (err) {
            log.error(`@${agentName} hata verdi`);
            log.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
          }

          return;
        }

        // Pipeline mode
        log.info(`Pipeline fazi: ${chalk.bold(phase)}`);
        if (options.auto) {
          log.warn('Otomatik onay modu aktif');
        }

        const pipelineSpinner = ora('Pipeline baslatiliyor...').start();

        try {
          pipelineSpinner.text = 'Pipeline calisiyor...';

          const result = await orchestrator.run(storyId, {
            phase,
            autoApprove: options.auto,
          });

          pipelineSpinner.stop();
          log.divider();

          if (result.success) {
            log.success('Pipeline basariyla tamamlandi!');
            console.log(
              chalk.gray(`  Toplam token: ${result.totalTokensUsed}`)
            );
            console.log(
              chalk.gray(`  Toplam sure: ${result.totalDuration.toFixed(1)}s`)
            );
            console.log(
              chalk.gray(`  Adim sayisi: ${result.steps.length}`)
            );
          } else {
            log.error('Pipeline hatasi:');
            log.error(result.error || 'Bilinmeyen hata');
          }
        } catch (err) {
          pipelineSpinner.fail('Pipeline calistirilamadi');
          log.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      } catch (err) {
        log.error(`Run hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
