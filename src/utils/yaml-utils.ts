import YAML from 'yaml';

export function parseYaml<T>(content: string): T {
  return YAML.parse(content) as T;
}

export function stringifyYaml(data: unknown): string {
  return YAML.stringify(data, { lineWidth: 120 });
}
