import fs from 'fs-extra';
import path from 'path';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.ensureDir(dirPath);
}

export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function listFiles(dirPath: string, ext?: string): Promise<string[]> {
  if (!(await fs.pathExists(dirPath))) return [];
  const files = await fs.readdir(dirPath);
  if (ext) return files.filter(f => f.endsWith(ext));
  return files;
}

export function resolveProjectPath(...parts: string[]): string {
  return path.resolve(process.cwd(), ...parts);
}
