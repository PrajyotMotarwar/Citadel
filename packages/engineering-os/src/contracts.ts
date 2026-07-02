export type ProviderId = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'xai';
export type TaskRisk = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'queued' | 'running' | 'awaiting-approval' | 'completed' | 'failed';
export type AgentRole =
  | 'architect'
  | 'backend'
  | 'frontend'
  | 'qa'
  | 'devops'
  | 'security'
  | 'documentation'
  | 'performance'
  | 'error-analysis'
  | 'incident-response'
  | 'autonomous-testing';

export interface EngineeringTask {
  id: string;
  prompt: string;
  projectRoot: string;
  status: TaskStatus;
  risk: TaskRisk;
  route: string;
  roles: AgentRole[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface ProviderRequest {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderResponse {
  provider: ProviderId;
  model: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs: number;
}

export interface LlmProvider {
  id: ProviderId;
  isAvailable(): boolean;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface TaskStore {
  initialize(): Promise<void>;
  saveTask(task: EngineeringTask): Promise<void>;
  getTask(id: string): Promise<EngineeringTask | null>;
  listTasks(limit?: number): Promise<EngineeringTask[]>;
  appendEvent(taskId: string, type: string, payload: Record<string, unknown>): Promise<void>;
}

export interface MemoryRecord {
  id: string;
  namespace: string;
  text: string;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryStore {
  initialize(): Promise<void>;
  remember(record: MemoryRecord): Promise<void>;
  search(query: string, options?: { namespace?: string; limit?: number }): Promise<MemoryRecord[]>;
}

export interface VectorStore {
  upsert(records: MemoryRecord[]): Promise<void>;
  search(query: string, limit: number, namespace?: string): Promise<MemoryRecord[]>;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  action: string;
  reason: string;
  risk: TaskRisk;
  command?: string;
  expiresAt?: string;
}

export interface ApprovalGate {
  requiresApproval(input: { action: string; risk: TaskRisk; destructive?: boolean; deployment?: boolean }): boolean;
  request(input: Omit<ApprovalRequest, 'id'>): Promise<ApprovalRequest>;
  isApproved(id: string): Promise<boolean>;
}

export interface AgentContext {
  task: EngineeringTask;
  provider: LlmProvider;
  memory: MemoryStore;
  logger: Logger;
  signal?: AbortSignal;
}

export interface AgentResult {
  role: AgentRole;
  summary: string;
  artifacts: string[];
  findings: Array<{ severity: string; message: string; file?: string }>;
  metadata: Record<string, unknown>;
}

export interface EngineeringAgent {
  role: AgentRole;
  description: string;
  execute(context: AgentContext): Promise<AgentResult>;
}
