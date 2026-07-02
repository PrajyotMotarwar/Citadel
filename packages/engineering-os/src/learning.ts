import { randomUUID } from 'crypto';
import type { MemoryStore } from './contracts';

export interface Feedback {
  taskId: string;
  outcome: 'accepted' | 'rejected' | 'partial';
  correction?: string;
  fix?: string;
  tags?: string[];
}

export class LearningService {
  constructor(private readonly memory: MemoryStore) {}

  async record(feedback: Feedback): Promise<void> {
    const lessons = [
      `Outcome: ${feedback.outcome}`,
      feedback.fix ? `Successful fix: ${feedback.fix}` : '',
      feedback.correction ? `Feedback: ${feedback.correction}` : '',
    ].filter(Boolean).join('\n');
    await this.memory.remember({
      id: randomUUID(),
      namespace: 'learned-fixes',
      text: lessons,
      source: `task:${feedback.taskId}`,
      metadata: { taskId: feedback.taskId, outcome: feedback.outcome, tags: feedback.tags || [] },
      createdAt: new Date().toISOString(),
    });
  }
}
