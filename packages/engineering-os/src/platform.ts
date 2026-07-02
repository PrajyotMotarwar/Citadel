import type { AgentResult, EngineeringTask, MemoryStore, TaskStore } from './contracts';
import type { Logger } from './contracts';
import { AgentFactory, ParallelAgentExecutor } from './agents';
import { FileApprovalGate } from './approvals';
import { NaturalLanguageRouter } from './router';
import { ProviderRouter } from './providers';
import { CheckpointManager, withRetry } from './recovery';

export interface EngineeringOsDependencies {
  taskStore: TaskStore;
  memory: MemoryStore;
  providers: ProviderRouter;
  logger: Logger;
  agentFactory?: AgentFactory;
  executor?: ParallelAgentExecutor;
}

export class EngineeringOperatingSystem {
  private readonly router = new NaturalLanguageRouter();
  private readonly factory: AgentFactory;
  private readonly executor: ParallelAgentExecutor;

  constructor(private readonly dependencies: EngineeringOsDependencies) {
    this.factory = dependencies.agentFactory || new AgentFactory();
    this.executor = dependencies.executor || new ParallelAgentExecutor();
  }

  async initialize(): Promise<void> {
    await Promise.all([this.dependencies.taskStore.initialize(), this.dependencies.memory.initialize()]);
  }

  plan(prompt: string, projectRoot: string): EngineeringTask {
    return this.router.route(prompt, projectRoot);
  }

  async run(prompt: string, projectRoot: string): Promise<{ task: EngineeringTask; results: AgentResult[] }> {
    await this.initialize();
    const task = this.plan(prompt, projectRoot);
    const approval = new FileApprovalGate(projectRoot);
    if (approval.requiresApproval({ action: task.route, risk: task.risk, destructive: false, deployment: /\bdeploy|release\b/i.test(prompt) })) {
      const request = await approval.request({
        taskId: task.id,
        action: task.route,
        reason: 'Citadel requires human approval for high-risk or deployment work.',
        risk: task.risk,
      });
      task.status = 'awaiting-approval';
      task.metadata.approvalId = request.id;
      task.updatedAt = new Date().toISOString();
      await this.dependencies.taskStore.saveTask(task);
      return { task, results: [] };
    }

    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    await this.dependencies.taskStore.saveTask(task);
    const checkpoint = new CheckpointManager(projectRoot);
    await checkpoint.save({ id: task.id, taskId: task.id, state: task, attempt: 0, createdAt: new Date().toISOString() });

    try {
      const provider = this.dependencies.providers.select({ task: prompt, costSensitive: task.risk === 'low' });
      const agents = this.factory.createTeam(task.roles);
      const results = await withRetry(
        (attempt) => this.executor.execute(agents, {
          task,
          provider,
          memory: this.dependencies.memory,
          logger: this.dependencies.logger,
        }).finally(() => checkpoint.save({
          id: task.id,
          taskId: task.id,
          state: task,
          attempt,
          createdAt: new Date().toISOString(),
        })),
        { maxAttempts: 3 },
      );
      task.status = 'completed';
      task.updatedAt = new Date().toISOString();
      await this.dependencies.taskStore.saveTask(task);
      await this.dependencies.taskStore.appendEvent(task.id, 'team-completed', { roles: task.roles, resultCount: results.length });
      return { task, results };
    } catch (error) {
      task.status = 'failed';
      task.updatedAt = new Date().toISOString();
      task.metadata.error = error instanceof Error ? error.message : String(error);
      await this.dependencies.taskStore.saveTask(task);
      throw error;
    }
  }
}
