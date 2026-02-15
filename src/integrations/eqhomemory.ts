import type { EqhoMemoryConfig } from '../types/index.js';

interface MemorySearchResult {
  session_id: string;
  content: string;
  date: string;
  score: number;
}

export class EqhoMemory {
  private serverUrl: string;

  constructor(config: EqhoMemoryConfig) {
    this.serverUrl = config.server_url;
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    try {
      const url = `${this.serverUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json() as { results: MemorySearchResult[] };
      return data.results || [];
    } catch {
      return [];
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
