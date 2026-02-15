import matter from 'gray-matter';
import path from 'path';
import { readFile, fileExists, listFiles, resolveProjectPath } from '../utils/file-utils.js';
import type { Story, StoryFrontmatter, EqhoConfig } from '../types/index.js';

export function parseStory(content: string, filePath: string): Story {
  const { data, content: body } = matter(content);
  const frontmatter = data as StoryFrontmatter;

  // Extract sections by ## headings
  const sections: Record<string, string> = {};
  const sectionRegex = /^## (.+)$/gm;
  let match;
  const headings: { name: string; index: number }[] = [];

  while ((match = sectionRegex.exec(body)) !== null) {
    headings.push({ name: match[1].trim(), index: match.index });
  }

  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index + headings[i].name.length + 4; // ## + \n
    const end = i + 1 < headings.length ? headings[i + 1].index : body.length;
    sections[headings[i].name] = body.slice(start, end).trim();
  }

  return { frontmatter, body, sections, filePath };
}

export async function loadStory(storyId: string, config: EqhoConfig): Promise<Story> {
  const storiesDir = resolveProjectPath(config.paths.stories);
  const files = await listFiles(storiesDir, '.md');

  for (const file of files) {
    if (file.startsWith('_')) continue; // skip templates
    const filePath = path.join(storiesDir, file);
    const content = await readFile(filePath);
    const story = parseStory(content, filePath);
    if (story.frontmatter.id === storyId) {
      return story;
    }
  }

  throw new Error(`Story bulunamadi: ${storyId}`);
}

export async function listStories(config: EqhoConfig, statusFilter?: string): Promise<Story[]> {
  const storiesDir = resolveProjectPath(config.paths.stories);
  if (!(await fileExists(storiesDir))) return [];

  const files = await listFiles(storiesDir, '.md');
  const stories: Story[] = [];

  for (const file of files) {
    if (file.startsWith('_')) continue;
    const filePath = path.join(storiesDir, file);
    const content = await readFile(filePath);
    const story = parseStory(content, filePath);
    if (!statusFilter || story.frontmatter.status === statusFilter) {
      stories.push(story);
    }
  }

  return stories.sort((a, b) => a.frontmatter.id.localeCompare(b.frontmatter.id));
}

export async function getNextStoryId(config: EqhoConfig): Promise<string> {
  const stories = await listStories(config);
  if (stories.length === 0) return 'EQHO-001';

  const maxNum = stories.reduce((max, s) => {
    const num = parseInt(s.frontmatter.id.replace('EQHO-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return `EQHO-${String(maxNum + 1).padStart(3, '0')}`;
}
