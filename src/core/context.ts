import { readFile, fileExists, resolveProjectPath } from '../utils/file-utils.js';
import { log } from '../utils/logger.js';
import type { EqhoConfig, PipelineStep } from '../types/index.js';

/**
 * Loads the project context markdown file from .eqho-aios/context/project-context.md.
 * Returns the file content as a string, or undefined if not found.
 */
export async function loadProjectContext(config: EqhoConfig): Promise<string | undefined> {
  const contextDir = config.paths.context || '.eqho-aios/context';
  const contextPath = resolveProjectPath(contextDir, 'project-context.md');

  if (!(await fileExists(contextPath))) {
    return undefined;
  }

  try {
    const content = await readFile(contextPath);
    log.info('Proje baglami yuklendi');
    return content;
  } catch {
    log.warn(`Proje baglami okunamadi: ${contextPath}`);
    return undefined;
  }
}

/**
 * Loads the tech stack markdown file from .eqho-aios/context/tech-stack.md.
 * Returns the file content as a string, or undefined if not found.
 */
export async function loadTechStack(config: EqhoConfig): Promise<string | undefined> {
  const contextDir = config.paths.context || '.eqho-aios/context';
  const stackPath = resolveProjectPath(contextDir, 'tech-stack.md');

  if (!(await fileExists(stackPath))) {
    return undefined;
  }

  try {
    const content = await readFile(stackPath);
    log.info('Teknoloji yigini yuklendi');
    return content;
  } catch {
    log.warn(`Teknoloji yigini okunamadi: ${stackPath}`);
    return undefined;
  }
}

/**
 * Returns the N most recent pipeline steps from the given array.
 * This limits the context window to avoid exceeding token limits
 * when passing previous agent outputs to subsequent agents.
 */
export function getRelevantSteps(
  steps: PipelineStep[],
  windowSize: number
): PipelineStep[] {
  if (steps.length <= windowSize) {
    return steps;
  }
  return steps.slice(-windowSize);
}
