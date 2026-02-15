import matter from 'gray-matter';
import { readFile, fileExists, resolveProjectPath } from '../utils/file-utils.js';
import { log } from '../utils/logger.js';
import type { AgentName, AgentPrompt, EqhoConfig } from '../types/index.js';
import { fileURLToPath } from 'url';
import path from 'path';

/** Maps AgentName to the expected markdown filename. */
const AGENT_FILES: Record<AgentName, string> = {
  analyst: 'analyst.md',
  architect: 'architect.md',
  developer: 'developer.md',
  qa: 'qa.md',
  scrum_master: 'scrum-master.md',
};

/** All known agent names. */
const ALL_AGENTS: AgentName[] = ['analyst', 'architect', 'developer', 'qa', 'scrum_master'];

/**
 * Extracts list items from a markdown section body.
 * Each line starting with "- " or "* " is treated as an item.
 */
function extractListItems(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') || line.startsWith('* '))
    .map((line) => line.replace(/^[-*]\s+/, ''));
}

/**
 * Extracts sections from markdown content by ## headings.
 * Returns a map of heading text (lowercase, trimmed) to section body.
 */
function extractSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split('\n');

  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);

    if (headingMatch) {
      // Save previous section
      if (currentHeading !== null) {
        sections.set(currentHeading, currentBody.join('\n').trim());
      }
      currentHeading = headingMatch[1].trim().toLowerCase();
      currentBody = [];
    } else if (currentHeading !== null) {
      currentBody.push(line);
    }
  }

  // Save last section
  if (currentHeading !== null) {
    sections.set(currentHeading, currentBody.join('\n').trim());
  }

  return sections;
}

/**
 * Parses an agent markdown file into an AgentPrompt.
 */
function parseAgentMarkdown(name: AgentName, content: string): AgentPrompt {
  const { data: frontmatter, content: body } = matter(content);

  const sections = extractSections(body);

  // Map Turkish section headings to AgentPrompt fields
  const identity = sections.get('kimlik') ?? '';
  const capabilities = extractListItems(sections.get('yetenekler') ?? '');
  const commands = extractListItems(sections.get('komutlar') ?? '');
  const scope = extractListItems(sections.get('kapsam') ?? '');
  const rules = extractListItems(sections.get('calisma kurallari') ?? sections.get('kurallar') ?? '');
  const outputFormat = sections.get('cikti formati') ?? '';

  return {
    name,
    displayName: (frontmatter.displayName as string) ?? (frontmatter.display_name as string) ?? name,
    description: (frontmatter.description as string) ?? '',
    phase: (frontmatter.phase as AgentPrompt['phase']) ?? 'both',
    order: (frontmatter.order as number) ?? 0,
    identity,
    capabilities,
    commands,
    scope,
    rules,
    outputFormat,
    rawContent: content,
  };
}

/**
 * Resolves the path to the bundled agents directory (agents/ at package root).
 */
function getBundledAgentPath(filename: string): string {
  // import.meta.url is at dist/src/core/agent-loader.js → go up 3 levels to package root
  const bundledUrl = new URL(`../../../agents/${filename}`, import.meta.url);
  return fileURLToPath(bundledUrl);
}

/**
 * Loads a single agent by name.
 * First checks for a custom override in the project directory,
 * then falls back to the bundled agent markdown file.
 */
export async function loadAgent(
  name: AgentName,
  config: EqhoConfig
): Promise<AgentPrompt> {
  const filename = AGENT_FILES[name];

  // 1. Check custom override path
  const customDir = config.paths.agents || '.eqho-aios/agents';
  const customPath = resolveProjectPath(customDir, filename);

  if (await fileExists(customPath)) {
    log.info(`Ozel agent yukluyor: ${customPath}`);
    const content = await readFile(customPath);
    return parseAgentMarkdown(name, content);
  }

  // 2. Fall back to bundled agent
  const bundledPath = getBundledAgentPath(filename);

  if (await fileExists(bundledPath)) {
    const content = await readFile(bundledPath);
    return parseAgentMarkdown(name, content);
  }

  throw new Error(
    `Agent dosyasi bulunamadi: ${name}\n` +
    `Aranan konumlar:\n` +
    `  - ${customPath}\n` +
    `  - ${bundledPath}`
  );
}

/**
 * Loads all agents defined in ALL_AGENTS.
 * Skips agents that are disabled in config.
 * Returns a Map of AgentName to AgentPrompt.
 */
export async function loadAllAgents(
  config: EqhoConfig
): Promise<Map<AgentName, AgentPrompt>> {
  const agents = new Map<AgentName, AgentPrompt>();

  for (const name of ALL_AGENTS) {
    const agentConfig = config.agents[name];

    if (!agentConfig?.enabled) {
      log.info(`Agent devre disi: ${name}`);
      continue;
    }

    try {
      const agent = await loadAgent(name, config);
      agents.set(name, agent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Agent yuklenemedi (${name}): ${message}`);
    }
  }

  if (agents.size === 0) {
    throw new Error('Hicbir agent yuklenemedi. Agent dosyalarini kontrol edin.');
  }

  log.success(`${agents.size} agent yuklendi`);
  return agents;
}
