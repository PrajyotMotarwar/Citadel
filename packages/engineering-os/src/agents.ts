import type { AgentContext, AgentResult, AgentRole, EngineeringAgent } from './contracts';

const DESCRIPTIONS: Record<AgentRole, string> = {
  architect: 'Defines boundaries, decisions, dependencies, and migration-safe architecture.',
  backend: 'Builds APIs, services, persistence, and integration contracts.',
  frontend: 'Builds accessible user interfaces and client-side workflows.',
  qa: 'Plans and executes risk-based quality assurance.',
  devops: 'Builds delivery, infrastructure, deployment, and operational automation.',
  security: 'Audits trust boundaries, dependencies, secrets, and unsafe behavior.',
  documentation: 'Creates operator, developer, API, and release documentation.',
  performance: 'Profiles bottlenecks and proposes measurable optimizations.',
  'error-analysis': 'Performs root-cause analysis from errors, logs, and code paths.',
  'incident-response': 'Coordinates containment, mitigation, recovery, and post-incident evidence.',
  'autonomous-testing': 'Generates and executes tests until declared verification gates pass.',
};

export class SpecialistAgent implements EngineeringAgent {
  readonly description: string;

  constructor(readonly role: AgentRole) {
    this.description = DESCRIPTIONS[role];
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const memories = await context.memory.search(context.task.prompt, { limit: 5 });
    const response = await context.provider.complete({
      system: [
        `You are Citadel's ${this.role} agent.`,
        this.description,
        'Preserve existing behavior, cite concrete files when available, and return actionable engineering output.',
      ].join(' '),
      prompt: [
        `Task: ${context.task.prompt}`,
        `Route: ${context.task.route}`,
        `Risk: ${context.task.risk}`,
        memories.length ? `Relevant memory:\n${memories.map((item) => `- ${item.text.slice(0, 800)}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n'),
    });
    return {
      role: this.role,
      summary: response.content,
      artifacts: [],
      findings: [],
      metadata: { provider: response.provider, model: response.model, latencyMs: response.latencyMs },
    };
  }
}

export class AgentFactory {
  create(role: AgentRole): EngineeringAgent {
    return new SpecialistAgent(role);
  }

  createTeam(roles: AgentRole[]): EngineeringAgent[] {
    return [...new Set(roles)].map((role) => this.create(role));
  }
}

export class ParallelAgentExecutor {
  constructor(private readonly maxConcurrency = 4) {}

  async execute(agents: EngineeringAgent[], context: AgentContext): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let cursor = 0;
    const workers = Array.from({ length: Math.min(this.maxConcurrency, agents.length) }, async () => {
      while (cursor < agents.length) {
        const index = cursor++;
        results[index] = await agents[index].execute(context);
      }
    });
    await Promise.all(workers);
    return results;
  }
}
