import { randomUUID } from 'crypto';
import type { AgentRole, EngineeringTask, TaskRisk } from './contracts';

const ROLE_RULES: Array<[RegExp, AgentRole]> = [
  [/\b(architecture|design|system|dependency|api flow)\b/i, 'architect'],
  [/\b(api|backend|database|server|service)\b/i, 'backend'],
  [/\b(frontend|ui|ux|react|next|css)\b/i, 'frontend'],
  [/\b(tests?|qa|coverage|browser|regression)\b/i, 'qa'],
  [/\b(ci|cd|deploy|docker|aws|azure|vercel|infra)\b/i, 'devops'],
  [/\b(security|vulnerability|secret|permission|audit)\b/i, 'security'],
  [/\b(document|readme|release note|docs)\b/i, 'documentation'],
  [/\b(performance|latency|memory leak|optimi[sz])\b/i, 'performance'],
  [/\b(error|exception|failure|debug|root cause)\b/i, 'error-analysis'],
  [/\b(incident|outage|sev[0-9]|postmortem)\b/i, 'incident-response'],
  [/\b(autonomous test|test generation|fuzz|property test)\b/i, 'autonomous-testing'],
];

export class NaturalLanguageRouter {
  route(prompt: string, projectRoot: string): EngineeringTask {
    const roles = ROLE_RULES.filter(([pattern]) => pattern.test(prompt)).map(([, role]) => role);
    const uniqueRoles = [...new Set<AgentRole>(roles.length ? roles : ['architect'])];
    const risk = this.classifyRisk(prompt);
    const complex = uniqueRoles.length >= 3 || /\b(production|platform|entire|all|multi-agent|parallel)\b/i.test(prompt);
    const route = complex ? '/fleet --quick' : uniqueRoles.length > 1 ? '/marshal' : this.roleRoute(uniqueRoles[0]);
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      prompt,
      projectRoot,
      status: 'queued',
      risk,
      route,
      roles: uniqueRoles,
      createdAt: now,
      updatedAt: now,
      metadata: { source: prompt.trim().startsWith('/do') ? 'do-command' : 'natural-language' },
    };
  }

  private classifyRisk(prompt: string): TaskRisk {
    if (/\b(delete production|drop database|destroy|rotate credentials|force push)\b/i.test(prompt)) return 'critical';
    if (/\b(deploy|release|migration|delete|production|credential)\b/i.test(prompt)) return 'high';
    if (/\b(write|modify|install|upgrade|refactor)\b/i.test(prompt)) return 'medium';
    return 'low';
  }

  private roleRoute(role: AgentRole): string {
    const routes: Partial<Record<AgentRole, string>> = {
      qa: '/qa',
      security: '/review',
      'error-analysis': '/systematic-debugging',
      documentation: '/doc-gen',
      architect: '/architect',
      devops: '/infra-audit',
    };
    return routes[role] || '/marshal';
  }
}
