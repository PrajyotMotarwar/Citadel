import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';

export interface Checkpoint<T> {
  id: string;
  taskId: string;
  state: T;
  attempt: number;
  createdAt: string;
}

export class CheckpointManager {
  constructor(private readonly projectRoot: string) {}

  async save<T>(checkpoint: Checkpoint<T>): Promise<string> {
    const dir = this.dir();
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, `${checkpoint.taskId}.json`);
    const temp = `${target}.tmp`;
    await writeFile(temp, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
    await rename(temp, target);
    return target;
  }

  async load<T>(taskId: string): Promise<Checkpoint<T> | null> {
    try {
      return JSON.parse(await readFile(path.join(this.dir(), `${taskId}.json`), 'utf8')) as Checkpoint<T>;
    } catch {
      return null;
    }
  }

  private dir(): string {
    return path.join(this.projectRoot, '.planning', 'checkpoints');
  }
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; retryable?: (error: unknown) => boolean } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || options.retryable?.(error) === false) break;
      const delay = (options.baseDelayMs || 250) * (2 ** (attempt - 1));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
