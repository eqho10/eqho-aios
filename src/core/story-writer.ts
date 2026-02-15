import matter from 'gray-matter';
import { writeFile } from '../utils/file-utils.js';
import type { Story, AgentName, StoryFrontmatter, StoryStatus } from '../types/index.js';

export function serializeStory(story: Story): string {
  return matter.stringify(story.body, story.frontmatter as unknown as Record<string, unknown>);
}

export async function updateStoryFrontmatter(
  story: Story,
  updates: Partial<StoryFrontmatter>
): Promise<Story> {
  const updated: Story = {
    ...story,
    frontmatter: {
      ...story.frontmatter,
      ...updates,
      updated: new Date().toISOString().split('T')[0],
    },
  };
  await writeFile(updated.filePath, serializeStory(updated));
  return updated;
}

export async function appendAgentOutput(
  story: Story,
  agent: AgentName,
  output: string
): Promise<Story> {
  const sectionMap: Record<string, string> = {
    analyst: 'Gereksinimler (@analyst ciktisi)',
    architect: 'Mimari Tasarim (@architect ciktisi)',
    scrum_master: 'Yapilacaklar (@developer icin)',
    developer: 'Gelistirme Notlari (@developer ciktisi)',
    qa: 'QA Raporu (@qa ciktisi)',
  };

  const sectionName = sectionMap[agent];
  if (!sectionName) return story;

  // Replace section content in body
  const sectionHeader = `## ${sectionName}`;
  const headerIndex = story.body.indexOf(sectionHeader);

  let newBody: string;
  if (headerIndex !== -1) {
    // Find the end of this section (next ## or end of file)
    const afterHeader = headerIndex + sectionHeader.length;
    const nextSection = story.body.indexOf('\n## ', afterHeader);
    const sectionEnd = nextSection !== -1 ? nextSection : story.body.length;

    newBody =
      story.body.slice(0, afterHeader) +
      '\n\n' + output + '\n\n' +
      story.body.slice(sectionEnd);
  } else {
    // Append section at end
    newBody = story.body + `\n\n${sectionHeader}\n\n${output}\n`;
  }

  // Update context history
  const historyEntry = `- ${new Date().toISOString().split('T')[0]} @${agent}: Tamamlandi`;
  const historySection = '## Baglam Gecmisi';
  const historyIndex = newBody.indexOf(historySection);
  if (historyIndex !== -1) {
    const insertPos = historyIndex + historySection.length;
    newBody = newBody.slice(0, insertPos) + '\n' + historyEntry + newBody.slice(insertPos);
  }

  // Update frontmatter
  const agentsCompleted = [...story.frontmatter.agents_completed];
  if (!agentsCompleted.includes(agent)) {
    agentsCompleted.push(agent);
  }

  const updated: Story = {
    ...story,
    body: newBody,
    frontmatter: {
      ...story.frontmatter,
      agents_completed: agentsCompleted,
      current_agent: null,
      updated: new Date().toISOString().split('T')[0],
    },
  };

  await writeFile(updated.filePath, serializeStory(updated));
  return updated;
}

export async function createStoryFile(
  filePath: string,
  frontmatter: StoryFrontmatter,
  title: string
): Promise<void> {
  const body = `
# ${frontmatter.id}: ${title}

## Ozet


## Gereksinimler (@analyst ciktisi)


## Mimari Tasarim (@architect ciktisi)


## Yapilacaklar (@developer icin)


## Test Kontrol Listesi (@qa icin)


## Gelistirme Notlari (@developer ciktisi)


## QA Raporu (@qa ciktisi)


## Baglam Gecmisi
`;

  const content = matter.stringify(body, frontmatter as unknown as Record<string, unknown>);
  await writeFile(filePath, content);
}
