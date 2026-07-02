import { readFile } from 'fs/promises';
import type { AgentRole } from './contracts';

export interface MarketplaceAgent {
  name: string;
  version: string;
  description: string;
  roles: AgentRole[];
  entrypoint: string;
  integrity?: string;
}

export class AgentMarketplace {
  constructor(private readonly allowedPublishers: string[] = []) {}

  async loadManifest(file: string): Promise<{ publisher?: string; agents: MarketplaceAgent[] }> {
    const manifest = JSON.parse(await readFile(file, 'utf8')) as { publisher?: string; agents?: MarketplaceAgent[] };
    if (!Array.isArray(manifest.agents)) throw new Error('Marketplace manifest must include an agents array');
    if (this.allowedPublishers.length && (!manifest.publisher || !this.allowedPublishers.includes(manifest.publisher))) {
      throw new Error(`Publisher ${manifest.publisher || 'unknown'} is not allowed`);
    }
    for (const agent of manifest.agents) {
      if (!agent.name || !agent.version || !agent.entrypoint || !agent.description) throw new Error('Invalid marketplace agent manifest');
    }
    return { ...manifest, agents: manifest.agents };
  }
}
