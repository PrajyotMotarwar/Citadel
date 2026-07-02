import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import type { ApprovalGate, ApprovalRequest, TaskRisk } from './contracts';

export class FileApprovalGate implements ApprovalGate {
  constructor(private readonly projectRoot: string) {}

  requiresApproval(input: { action: string; risk: TaskRisk; destructive?: boolean; deployment?: boolean }): boolean {
    return Boolean(input.destructive || input.deployment || input.risk === 'high' || input.risk === 'critical');
  }

  async request(input: Omit<ApprovalRequest, 'id'>): Promise<ApprovalRequest> {
    const request = { ...input, id: randomUUID() };
    const dir = this.dir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${request.id}.json`), `${JSON.stringify({ ...request, status: 'pending' }, null, 2)}\n`, 'utf8');
    return request;
  }

  async isApproved(id: string): Promise<boolean> {
    try {
      const value = JSON.parse(await readFile(path.join(this.dir(), `${id}.json`), 'utf8')) as { status?: string; expiresAt?: string };
      if (value.expiresAt && Date.parse(value.expiresAt) < Date.now()) return false;
      return value.status === 'approved';
    } catch {
      return false;
    }
  }

  private dir(): string {
    return path.join(this.projectRoot, '.planning', 'approvals');
  }
}
