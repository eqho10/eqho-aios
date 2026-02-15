import type { AgentPrompt, Story, PipelineStep } from '../types/index.js';

/**
 * Builds the full system prompt for an agent by combining identity,
 * capabilities, scope, rules, and output format with optional project context.
 */
export function buildSystemPrompt(
  agent: AgentPrompt,
  projectContext?: string,
  techStack?: string
): string {
  const sections: string[] = [];

  // Identity
  sections.push(`# ${agent.displayName}`);
  sections.push('');
  sections.push(`## Kimlik`);
  sections.push(agent.identity);

  // Description
  if (agent.description) {
    sections.push('');
    sections.push(`## Tanim`);
    sections.push(agent.description);
  }

  // Capabilities
  if (agent.capabilities.length > 0) {
    sections.push('');
    sections.push(`## Yetenekler`);
    for (const cap of agent.capabilities) {
      sections.push(`- ${cap}`);
    }
  }

  // Commands
  if (agent.commands.length > 0) {
    sections.push('');
    sections.push(`## Komutlar`);
    for (const cmd of agent.commands) {
      sections.push(`- ${cmd}`);
    }
  }

  // Scope
  if (agent.scope.length > 0) {
    sections.push('');
    sections.push(`## Kapsam`);
    for (const item of agent.scope) {
      sections.push(`- ${item}`);
    }
  }

  // Rules
  if (agent.rules.length > 0) {
    sections.push('');
    sections.push(`## Calisma Kurallari`);
    for (const rule of agent.rules) {
      sections.push(`- ${rule}`);
    }
  }

  // Output format
  if (agent.outputFormat) {
    sections.push('');
    sections.push(`## Cikti Formati`);
    sections.push(agent.outputFormat);
  }

  // Project context
  if (projectContext) {
    sections.push('');
    sections.push(`## Proje Baglamı`);
    sections.push(projectContext);
  }

  // Tech stack
  if (techStack) {
    sections.push('');
    sections.push(`## Teknoloji Yigini`);
    sections.push(techStack);
  }

  return sections.join('\n');
}

/**
 * Builds the user message for an agent, including the story content,
 * outputs from previous pipeline steps, and an optional task description.
 */
export function buildUserMessage(
  story: Story,
  previousOutputs: PipelineStep[],
  task?: string
): string {
  const parts: string[] = [];

  // Story header
  parts.push(`# Story: ${story.frontmatter.title}`);
  parts.push(`**ID:** ${story.frontmatter.id}`);
  parts.push(`**Oncelik:** ${story.frontmatter.priority}`);
  parts.push(`**Durum:** ${story.frontmatter.status}`);

  if (story.frontmatter.tags && story.frontmatter.tags.length > 0) {
    parts.push(`**Etiketler:** ${story.frontmatter.tags.join(', ')}`);
  }

  parts.push('');

  // Story body
  parts.push('## Story Icerigi');
  parts.push(story.body);

  // Story sections
  const sectionKeys = Object.keys(story.sections);
  if (sectionKeys.length > 0) {
    for (const key of sectionKeys) {
      parts.push('');
      parts.push(`### ${key}`);
      parts.push(story.sections[key]);
    }
  }

  // Previous agent outputs
  if (previousOutputs.length > 0) {
    parts.push('');
    parts.push('---');
    parts.push('## Onceki Agent Ciktilari');

    for (const step of previousOutputs) {
      parts.push('');
      parts.push(`### @${step.agent} Ciktisi`);
      parts.push(step.output);
    }
  }

  // Task description
  if (task) {
    parts.push('');
    parts.push('---');
    parts.push('## Gorev');
    parts.push(task);
  }

  return parts.join('\n');
}
