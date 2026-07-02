import { createHash, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import type { MemoryRecord, MemoryStore } from './contracts';

export interface KnowledgeSource {
  kind: 'pdf' | 'markdown' | 'github' | 'notion' | 'confluence';
  location: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface ContentLoader {
  supports(source: KnowledgeSource): boolean;
  load(source: KnowledgeSource): Promise<Array<{ text: string; source: string; metadata?: Record<string, unknown> }>>;
}

export class FileContentLoader implements ContentLoader {
  supports(source: KnowledgeSource): boolean {
    return source.kind === 'markdown' || source.kind === 'pdf';
  }

  async load(source: KnowledgeSource): Promise<Array<{ text: string; source: string; metadata?: Record<string, unknown> }>> {
    if (source.kind === 'pdf') {
      throw new Error('PDF ingestion requires an injected PDF text extractor; binary parsing is intentionally not guessed');
    }
    return [{ text: await readFile(source.location, 'utf8'), source: source.location, metadata: source.metadata }];
  }
}

export class HttpContentLoader implements ContentLoader {
  constructor(
    private readonly kind: 'github' | 'notion' | 'confluence',
    private readonly fetchContent: (source: KnowledgeSource) => Promise<Array<{ text: string; source: string; metadata?: Record<string, unknown> }>>,
  ) {}

  supports(source: KnowledgeSource): boolean {
    return source.kind === this.kind;
  }

  load(source: KnowledgeSource): Promise<Array<{ text: string; source: string; metadata?: Record<string, unknown> }>> {
    return this.fetchContent(source);
  }
}

export class KnowledgeBase {
  constructor(
    private readonly memory: MemoryStore,
    private readonly loaders: ContentLoader[],
    private readonly chunkSize = 1800,
    private readonly overlap = 200,
  ) {}

  async ingest(source: KnowledgeSource): Promise<{ source: string; chunks: number }> {
    const loader = this.loaders.find((candidate) => candidate.supports(source));
    if (!loader) throw new Error(`No knowledge loader registered for ${source.kind}`);
    const documents = await loader.load(source);
    let chunks = 0;
    for (const document of documents) {
      for (const text of this.chunk(document.text)) {
        const digest = createHash('sha256').update(`${document.source}:${text}`).digest('hex');
        const record: MemoryRecord = {
          id: randomUUID(),
          namespace: source.namespace || 'knowledge',
          text,
          source: document.source,
          metadata: { ...source.metadata, ...document.metadata, digest, kind: source.kind },
          createdAt: new Date().toISOString(),
        };
        await this.memory.remember(record);
        chunks += 1;
      }
    }
    return { source: source.location, chunks };
  }

  search(query: string, namespace = 'knowledge', limit = 8): Promise<MemoryRecord[]> {
    return this.memory.search(query, { namespace, limit });
  }

  private chunk(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];
    const chunks: string[] = [];
    for (let start = 0; start < normalized.length; start += this.chunkSize - this.overlap) {
      chunks.push(normalized.slice(start, start + this.chunkSize));
      if (start + this.chunkSize >= normalized.length) break;
    }
    return chunks;
  }
}
