import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import Handlebars from 'handlebars';
import matter from 'gray-matter';
import { log } from '../../utils/logger.js';
import {
  readFile,
  writeFile,
  fileExists,
  listFiles,
  resolveProjectPath,
} from '../../utils/file-utils.js';
import type { StoryFrontmatter, StoryStatus, StoryPriority } from '../../types/index.js';

async function loadAllStories(
  storiesDir: string
): Promise<Array<{ frontmatter: StoryFrontmatter; filePath: string; body: string }>> {
  const files = await listFiles(storiesDir, '.md');
  const stories: Array<{ frontmatter: StoryFrontmatter; filePath: string; body: string }> = [];

  for (const file of files) {
    if (file.startsWith('_')) continue;
    const filePath = path.join(storiesDir, file);
    const content = await readFile(filePath);
    const { data, content: body } = matter(content);
    stories.push({
      frontmatter: data as StoryFrontmatter,
      filePath,
      body,
    });
  }

  return stories;
}

function getNextStoryId(stories: Array<{ frontmatter: StoryFrontmatter }>): string {
  let maxNum = 0;

  for (const story of stories) {
    const match = story.frontmatter.id?.match(/EQHO-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = maxNum + 1;
  return `EQHO-${String(nextNum).padStart(3, '0')}`;
}

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

export function registerStoryCommand(program: Command): void {
  const story = program
    .command('story')
    .description('Manage stories');

  // story create
  story
    .command('create')
    .argument('<title>', 'Story title')
    .option('--priority <priority>', 'Priority: critical, high, medium, low', 'medium')
    .option('--tags <tags>', 'Comma-separated tags')
    .description('Create a new story')
    .action(async (title: string, options: { priority: string; tags?: string }) => {
      try {
        log.title('EqhoAIOS - Story Olustur');

        const storiesDir = resolveProjectPath('docs', 'stories');
        if (!(await fileExists(storiesDir))) {
          log.error("Stories dizini bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        // Load existing stories to determine next ID
        const existingStories = await loadAllStories(storiesDir);
        const storyId = getNextStoryId(existingStories);

        // Parse tags
        const tags = options.tags ? options.tags.split(',').map(t => t.trim()) : [];

        // Read and compile the story template
        const templatePath = path.resolve(
          path.dirname(new URL(import.meta.url).pathname),
          '../../../templates/story-template.md.hbs'
        );

        let storyContent: string;

        if (await fileExists(templatePath)) {
          const templateRaw = await readFile(templatePath);
          const template = Handlebars.compile(templateRaw);
          storyContent = template({
            id: storyId,
            title,
            priority: options.priority as StoryPriority,
            created: new Date().toISOString().split('T')[0],
            tags: tags.length > 0 ? tags : undefined,
          });
        } else {
          // Fallback: generate inline
          const frontmatter: StoryFrontmatter = {
            id: storyId,
            title,
            status: 'draft',
            priority: options.priority as StoryPriority,
            phase: '',
            current_agent: null,
            agents_completed: [],
            created: new Date().toISOString().split('T')[0],
            tags: tags.length > 0 ? tags : undefined,
            estimated_tokens: 0,
            actual_tokens: 0,
          };

          storyContent = `---\n`;
          storyContent += `id: "${frontmatter.id}"\n`;
          storyContent += `title: "${frontmatter.title}"\n`;
          storyContent += `status: "${frontmatter.status}"\n`;
          storyContent += `priority: "${frontmatter.priority}"\n`;
          storyContent += `phase: ""\n`;
          storyContent += `current_agent: null\n`;
          storyContent += `agents_completed: []\n`;
          storyContent += `created: "${frontmatter.created}"\n`;
          if (tags.length > 0) {
            storyContent += `tags: [${tags.map(t => `"${t}"`).join(', ')}]\n`;
          }
          storyContent += `estimated_tokens: 0\n`;
          storyContent += `actual_tokens: 0\n`;
          storyContent += `---\n\n`;
          storyContent += `## User Story\n\n`;
          storyContent += `**Baslik:** ${title}\n\n`;
          storyContent += `**Aciklama:**\nAs a [user type], I want [goal] so that [benefit].\n\n`;
          storyContent += `## Kabul Kriterleri\n\n- [ ] Kriter 1\n\n`;
          storyContent += `## Teknik Notlar\n\n`;
        }

        // Write the story file
        const fileName = `${storyId.toLowerCase()}-${title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}.md`;
        const filePath = path.join(storiesDir, fileName);
        await writeFile(filePath, storyContent);

        log.success(`Story olusturuldu: ${storyId}`);
        console.log(chalk.gray(`  Dosya: ${filePath}`));
        console.log(chalk.gray(`  Baslik: ${title}`));
        console.log(chalk.gray(`  Oncelik: ${priorityColor(options.priority as StoryPriority)}`));
        if (tags.length > 0) {
          console.log(chalk.gray(`  Etiketler: ${tags.join(', ')}`));
        }
        console.log('');
        log.info('Story icerigini doldurup pipeline calistirin:');
        console.log(`  eqho-aios run ${storyId}`);
      } catch (err) {
        log.error(`Story olusturma hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // story list
  story
    .command('list')
    .option('--status <status>', 'Filter by status: draft, planning, ready, in_progress, review, done')
    .description('List all stories')
    .action(async (options: { status?: string }) => {
      try {
        const storiesDir = resolveProjectPath('docs', 'stories');
        if (!(await fileExists(storiesDir))) {
          log.error("Stories dizini bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        let stories = await loadAllStories(storiesDir);

        // Filter by status if specified
        if (options.status) {
          stories = stories.filter(s => s.frontmatter.status === options.status);
        }

        if (stories.length === 0) {
          log.info('Hic story bulunamadi.');
          if (options.status) {
            log.info(`Filtre: status=${options.status}`);
          }
          return;
        }

        log.title('Stories');

        // Table header
        const idWidth = 10;
        const statusWidth = 13;
        const priorityWidth = 10;
        const titleWidth = 40;
        const agentWidth = 12;

        const header =
          chalk.bold.white(
            'ID'.padEnd(idWidth) +
            'Durum'.padEnd(statusWidth) +
            'Oncelik'.padEnd(priorityWidth) +
            'Baslik'.padEnd(titleWidth) +
            'Agent'.padEnd(agentWidth)
          );
        console.log(header);
        console.log(chalk.gray('-'.repeat(idWidth + statusWidth + priorityWidth + titleWidth + agentWidth)));

        for (const s of stories) {
          const fm = s.frontmatter;
          const truncatedTitle = fm.title.length > titleWidth - 2
            ? fm.title.slice(0, titleWidth - 5) + '...'
            : fm.title;

          const row =
            chalk.cyan(fm.id.padEnd(idWidth)) +
            statusColor(fm.status).padEnd(statusWidth + 10) + // extra for ANSI codes
            priorityColor(fm.priority).padEnd(priorityWidth + 10) +
            chalk.white(truncatedTitle.padEnd(titleWidth)) +
            chalk.magenta((fm.current_agent || '-').padEnd(agentWidth));

          console.log(row);
        }

        console.log('');
        log.info(`Toplam: ${stories.length} story`);
      } catch (err) {
        log.error(`Story listeleme hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // story show
  story
    .command('show')
    .argument('<id>', 'Story ID (e.g., EQHO-001)')
    .description('Show story details')
    .action(async (id: string) => {
      try {
        const storiesDir = resolveProjectPath('docs', 'stories');
        if (!(await fileExists(storiesDir))) {
          log.error("Stories dizini bulunamadi. Once 'eqho-aios init' calistirin.");
          process.exit(1);
        }

        const stories = await loadAllStories(storiesDir);
        const story = stories.find(s => s.frontmatter.id === id);

        if (!story) {
          log.error(`Story bulunamadi: ${id}`);
          log.info('Mevcut storyleri gormek icin: eqho-aios story list');
          process.exit(1);
        }

        const fm = story.frontmatter;
        log.title(`${fm.id} - ${fm.title}`);

        console.log(chalk.gray('  Durum:     ') + statusColor(fm.status));
        console.log(chalk.gray('  Oncelik:   ') + priorityColor(fm.priority));
        console.log(chalk.gray('  Faz:       ') + chalk.white(fm.phase || '-'));
        console.log(chalk.gray('  Agent:     ') + chalk.magenta(fm.current_agent || '-'));
        console.log(chalk.gray('  Olusturma: ') + chalk.white(fm.created));
        if (fm.updated) {
          console.log(chalk.gray('  Guncelleme:') + chalk.white(fm.updated));
        }
        if (fm.tags && fm.tags.length > 0) {
          console.log(chalk.gray('  Etiketler: ') + chalk.cyan(fm.tags.join(', ')));
        }
        if (fm.agents_completed && fm.agents_completed.length > 0) {
          console.log(
            chalk.gray('  Tamamlanan:') +
            chalk.green(fm.agents_completed.join(', '))
          );
        }
        if (fm.estimated_tokens || fm.actual_tokens) {
          console.log(
            chalk.gray('  Token:     ') +
            chalk.white(`${fm.actual_tokens || 0} / ${fm.estimated_tokens || 0}`)
          );
        }

        log.divider();
        console.log(story.body);
      } catch (err) {
        log.error(`Story gosterme hatasi: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });
}
