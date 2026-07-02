import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';
import type { MemoryRecord, MemoryStore, TaskStore, EngineeringTask, VectorStore } from './contracts';

interface SqlDriver {
  execute(sql: string, params?: unknown[]): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export class SqlTaskStore implements TaskStore {
  constructor(private readonly driver: SqlDriver) {}

  async initialize(): Promise<void> {
    await this.driver.execute('CREATE TABLE IF NOT EXISTS citadel_tasks (id TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
    await this.driver.execute('CREATE TABLE IF NOT EXISTS citadel_events (task_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)');
  }

  async saveTask(task: EngineeringTask): Promise<void> {
    await this.driver.execute(
      'INSERT INTO citadel_tasks (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
      [task.id, JSON.stringify(task), task.updatedAt],
    );
  }

  async getTask(id: string): Promise<EngineeringTask | null> {
    const rows = await this.driver.query<{ payload: string }>('SELECT payload FROM citadel_tasks WHERE id = ?', [id]);
    return rows[0] ? JSON.parse(rows[0].payload) as EngineeringTask : null;
  }

  async listTasks(limit = 100): Promise<EngineeringTask[]> {
    const rows = await this.driver.query<{ payload: string }>('SELECT payload FROM citadel_tasks ORDER BY updated_at DESC LIMIT ?', [limit]);
    return rows.map((row) => JSON.parse(row.payload) as EngineeringTask);
  }

  async appendEvent(taskId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    await this.driver.execute(
      'INSERT INTO citadel_events (task_id, type, payload, created_at) VALUES (?, ?, ?, ?)',
      [taskId, type, JSON.stringify(payload), new Date().toISOString()],
    );
  }
}

export class JsonTaskStore implements TaskStore {
  constructor(private readonly projectRoot: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.dir(), { recursive: true });
  }

  async saveTask(task: EngineeringTask): Promise<void> {
    await this.initialize();
    await writeFile(path.join(this.dir(), `${task.id}.json`), `${JSON.stringify(task, null, 2)}\n`, 'utf8');
  }

  async getTask(id: string): Promise<EngineeringTask | null> {
    try {
      return JSON.parse(await readFile(path.join(this.dir(), `${id}.json`), 'utf8')) as EngineeringTask;
    } catch {
      return null;
    }
  }

  async listTasks(limit = 100): Promise<EngineeringTask[]> {
    await this.initialize();
    const files = await readdir(this.dir());
    const tasks = await Promise.all(files.filter((file) => file.endsWith('.json')).map(async (file) => JSON.parse(await readFile(path.join(this.dir(), file), 'utf8')) as EngineeringTask));
    return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }

  async appendEvent(taskId: string, type: string, payload: Record<string, unknown>): Promise<void> {
    const eventsDir = path.join(this.projectRoot, '.planning', 'engineering-os', 'events');
    await mkdir(eventsDir, { recursive: true });
    const file = path.join(eventsDir, `${taskId}.jsonl`);
    let current = '';
    try {
      current = await readFile(file, 'utf8');
    } catch {
      // First event for this task.
    }
    await writeFile(file, `${current}${JSON.stringify({ taskId, type, payload, createdAt: new Date().toISOString() })}\n`, 'utf8');
  }

  private dir(): string {
    return path.join(this.projectRoot, '.planning', 'engineering-os', 'tasks');
  }
}

export class MarkdownCompatibleMemoryStore implements MemoryStore {
  constructor(
    private readonly projectRoot: string,
    private readonly vectorStore?: VectorStore,
  ) {}

  async initialize(): Promise<void> {
    await mkdir(this.recordsDir(), { recursive: true });
  }

  async remember(record: MemoryRecord): Promise<void> {
    await this.initialize();
    await writeFile(path.join(this.recordsDir(), `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    if (this.vectorStore) await this.vectorStore.upsert([record]);
  }

  async search(query: string, options: { namespace?: string; limit?: number } = {}): Promise<MemoryRecord[]> {
    if (this.vectorStore) {
      const vectorResults = await this.vectorStore.search(query, options.limit || 10, options.namespace);
      if (vectorResults.length) return vectorResults;
    }

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const records = await this.readRecords();
    const markdown = await this.readLegacyMarkdown();
    return [...records, ...markdown]
      .filter((record) => !options.namespace || record.namespace === options.namespace)
      .map((record) => ({ record, score: terms.filter((term) => `${record.text} ${JSON.stringify(record.metadata)}`.toLowerCase().includes(term)).length }))
      .filter((entry) => entry.score > 0 || terms.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 10)
      .map((entry) => entry.record);
  }

  private recordsDir(): string {
    return path.join(this.projectRoot, '.planning', 'memory', 'records');
  }

  private async readRecords(): Promise<MemoryRecord[]> {
    try {
      const files = await readdir(this.recordsDir());
      return await Promise.all(files.filter((file) => file.endsWith('.json')).map(async (file) => JSON.parse(await readFile(path.join(this.recordsDir(), file), 'utf8')) as MemoryRecord));
    } catch {
      return [];
    }
  }

  private async readLegacyMarkdown(): Promise<MemoryRecord[]> {
    const candidates = [
      path.join(this.projectRoot, 'MEMORY.md'),
      path.join(this.projectRoot, '.planning', 'research', 'patterns.md'),
      path.join(this.projectRoot, '.planning', 'memory', 'MEMORY.md'),
    ];
    const records: MemoryRecord[] = [];
    for (const file of candidates) {
      try {
        const text = await readFile(file, 'utf8');
        records.push({
          id: `legacy-${Buffer.from(file).toString('base64url')}`,
          namespace: 'legacy-markdown',
          text,
          source: file,
          metadata: { compatibility: 'markdown' },
          createdAt: new Date().toISOString(),
        });
      } catch {
        // Optional compatibility source.
      }
    }
    return records;
  }
}

abstract class HttpVectorStore implements VectorStore {
  constructor(protected readonly baseUrl: string, protected readonly apiKey?: string) {}
  abstract upsert(records: MemoryRecord[]): Promise<void>;
  abstract search(query: string, limit: number, namespace?: string): Promise<MemoryRecord[]>;

  protected headers(): Record<string, string> {
    return { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) };
  }
}

export class QdrantVectorStore extends HttpVectorStore {
  constructor(
    baseUrl: string,
    private readonly collection = 'citadel',
    apiKey?: string,
    private readonly embed: (text: string) => Promise<number[]> = async () => [],
  ) {
    super(baseUrl.replace(/\/$/, ''), apiKey);
  }

  async upsert(records: MemoryRecord[]): Promise<void> {
    await this.request(`/collections/${this.collection}/points?wait=true`, 'PUT', {
      points: records.map((record) => ({ id: record.id, vector: record.metadata.embedding, payload: record })),
    });
  }

  async search(query: string, limit: number, namespace?: string): Promise<MemoryRecord[]> {
    const embedding = await this.embed(query);
    if (!embedding.length) return [];
    const payload = await this.request(`/collections/${this.collection}/points/search`, 'POST', {
      vector: embedding,
      limit,
      with_payload: true,
      filter: namespace ? { must: [{ key: 'namespace', match: { value: namespace } }] } : undefined,
    }) as { result?: Array<{ payload?: MemoryRecord }> };
    return payload.result?.flatMap((item) => item.payload ? [item.payload] : []) || [];
  }

  private async request(route: string, method: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${route}`, { method, headers: this.headers(), body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Qdrant request failed: ${response.status}`);
    return response.json();
  }
}

export class ChromaVectorStore extends HttpVectorStore {
  constructor(baseUrl: string, private readonly collectionId: string, apiKey?: string) {
    super(baseUrl.replace(/\/$/, ''), apiKey);
  }

  async upsert(records: MemoryRecord[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/upsert`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        ids: records.map((record) => record.id),
        documents: records.map((record) => record.text),
        metadatas: records.map((record) => ({ ...record.metadata, namespace: record.namespace, source: record.source })),
        embeddings: records.map((record) => record.metadata.embedding),
      }),
    });
    if (!response.ok) throw new Error(`Chroma request failed: ${response.status}`);
  }

  async search(query: string, limit: number, namespace?: string): Promise<MemoryRecord[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/collections/${this.collectionId}/query`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ query_texts: [query], n_results: limit, where: namespace ? { namespace } : undefined }),
    });
    if (!response.ok) throw new Error(`Chroma request failed: ${response.status}`);
    const payload = await response.json() as { ids?: string[][]; documents?: string[][]; metadatas?: Array<Array<Record<string, unknown>>> };
    return (payload.ids?.[0] || []).map((id, index) => ({
      id,
      namespace: String(payload.metadatas?.[0]?.[index]?.namespace || 'default'),
      text: payload.documents?.[0]?.[index] || '',
      source: String(payload.metadatas?.[0]?.[index]?.source || 'chroma'),
      metadata: payload.metadatas?.[0]?.[index] || {},
      createdAt: new Date().toISOString(),
    }));
  }
}
