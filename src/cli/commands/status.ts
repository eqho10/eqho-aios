import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import matter from 'gray-matter';
import { log } from '../../utils/logger.js';
import {
  readFile,
  fileExists,
  listFiles,
  resolveProjectPath,
} from '../../utils/file-utils.js';
import type { StoryFrontmatter, StoryStatus, StoryPriority } from '../../types/index.js';

function statusColor(status: StoryStatus): string {
  const colors: Record<StoryStatus, (s: string) => string> = {
    draft: chalk.gray,
    planning: chalk.blue,
    ready: chalk.cyan,
    in_progress: chalk.yellow,
    review: chalk.magenta,
    done: chalk.green,
  };
  return (colors[status] || chalk.white)(status);
}

function priorityColor(priority: StoryPriority): string {
  const colors: Record<StoryPriority, (s: string) => string> = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.gray,
  };
  return (colors[priority] || chalk.white)(priority);
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show project status overview')
    .action(async () => {
      try {
        log.title('EqhoAIOS - Proje Durumu');

        const storiesDir = resolveProjectPath('docs', 'stories');
        if (!(await fileExists(storiesDir))) {
          log.error("Stories dizini bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        const files = await listFiles(storiesDir, '.md');
        const stories: Array<{ frontmatter: StoryFrontmatter }> = [];

        for (const file of files) {
          if (file.startsWith('_')) continue;
          const filePath = path.join(storiesDir, file);
          const content = await readFile(filePath);
          const { data } = matter(content);
          stories.push({ frontmatter: data as StoryFrontmatter });
        }

        if (stories.length === 0) {
          log.info('Hic story bulunamadi.');
          log.info('Yeni story olusturun: eqho-aios story create "Baslik"');
          return;
        }

        // Status summary
        const statusCounts: Record<string, number> = {};
        let totalEstTokens = 0;
        let totalActTokens = 0;

        for (const s of stories) {
          const st = s.frontmatter.status || 'draft';
          statusCounts[st] = (statusCounts[st] || 0) + 1;
          totalEstTokens += s.frontmatter.estimated_tokens || 0;
          totalActTokens += s.frontmatter.actual_tokens || 0;
        }

        // Status overview
        console.log(chalk.bold.white('Durum Ozeti'));
        console.log(chalk.gray('-'.repeat(30)));
        const allStatuses: StoryStatus[] = ['draft', 'planning', 'ready', 'in_progress', 'review', 'done'];
        for (const st of allStatuses) {
          const count = statusCounts[st] || 0;
          if (count > 0) {
            console.log(`  ${statusColor(st).padEnd(22)} ${chalk.white(String(count))}`);
          }
        }
        console.log(chalk.gray('-'.repeat(30)));
        console.log(`  ${chalk.bold('Toplam').padEnd(12)} ${chalk.bold.white(String(stories.length))}`);
        console.log('');

        // Stories table
        console.log(chalk.bold.white('Story Detaylari'));
        console.log(chalk.gray('-'.repeat(80)));

        const idWidth = 10;
        const statusWidth = 13;
        const phaseWidth = 14;
        const agentWidth = 14;
        const titleWidth = 30;

        const header =
          chalk.bold.white(
            'ID'.padEnd(idWidth) +
            'Durum'.padEnd(statusWidth) +
            'Faz'.padEnd(phaseWidth) +
            'Agent'.padEnd(agentWidth) +
            'Baslik'.padEnd(titleWidth)
          );
        console.log(header);
        console.log(chalk.gray('-'.repeat(80)));

        for (const s of stories) {
          const fm = s.frontmatter;
          const truncTitle = fm.title.length > titleWidth - 2
            ? fm.title.slice(0, titleWidth - 5) + '...'
            : fm.title;

          const row =
            chalk.cyan((fm.id || '?').padEnd(idWidth)) +
            statusColor(fm.status) + ' '.repeat(Math.max(1, statusWidth - fm.status.length - 8)) +
            chalk.white((fm.phase || '-').padEnd(phaseWidth)) +
            chalk.magenta((fm.current_agent || '-').padEnd(agentWidth)) +
            chalk.white(truncTitle);

          console.log(row);
        }

        console.log('');

        // Token usage
        console.log(chalk.bold.white('Token Kullanimi'));
        console.log(chalk.gray('-'.repeat(30)));
        console.log(`  Tahmini:  ${chalk.white(totalEstTokens.toLocaleString())}`);
        console.log(`  Gercek:   ${chalk.white(totalActTokens.toLocaleString())}`);
        if (totalEstTokens > 0) {
          const pct = ((totalActTokens / totalEstTokens) * 100).toFixed(1);
          console.log(`  Oran:     ${chalk.yellow(pct + '%')}`);
        }
        console.log('');
      } catch (err) {
        log.error(`Status hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
