export interface DeliveryTarget {
  id: 'github-actions' | 'docker' | 'aws' | 'azure' | 'vercel';
  detect(files: string[]): boolean;
  plan(projectName: string): Array<{ title: string; command?: string; file?: string; approvalRequired: boolean }>;
}

export class StandardDeliveryTarget implements DeliveryTarget {
  constructor(
    readonly id: DeliveryTarget['id'],
    private readonly signals: RegExp[],
    private readonly steps: Array<{ title: string; command?: string; file?: string; approvalRequired: boolean }>,
  ) {}

  detect(files: string[]): boolean {
    return files.some((file) => this.signals.some((signal) => signal.test(file)));
  }

  plan(projectName: string): Array<{ title: string; command?: string; file?: string; approvalRequired: boolean }> {
    return this.steps.map((step) => ({
      ...step,
      command: step.command?.replaceAll('{project}', projectName),
    }));
  }
}

export function createDeliveryTargets(): DeliveryTarget[] {
  return [
    new StandardDeliveryTarget('github-actions', [/^\.github\/workflows\//], [
      { title: 'Generate or validate CI workflow', file: '.github/workflows/ci.yml', approvalRequired: false },
    ]),
    new StandardDeliveryTarget('docker', [/(^|\/)Dockerfile$/, /docker-compose\.ya?ml$/], [
      { title: 'Build container', command: 'docker build -t {project}:local .', approvalRequired: false },
      { title: 'Publish container', command: 'docker push {project}', approvalRequired: true },
    ]),
    new StandardDeliveryTarget('aws', [/cdk\.json$/, /serverless\.ya?ml$/, /template\.ya?ml$/], [
      { title: 'Preview AWS changes', command: 'npx cdk diff', approvalRequired: false },
      { title: 'Deploy AWS changes', command: 'npx cdk deploy', approvalRequired: true },
    ]),
    new StandardDeliveryTarget('azure', [/azure-pipelines\.ya?ml$/, /host\.json$/], [
      { title: 'Preview Azure deployment', command: 'az deployment group what-if', approvalRequired: false },
      { title: 'Deploy to Azure', command: 'az deployment group create', approvalRequired: true },
    ]),
    new StandardDeliveryTarget('vercel', [/vercel\.json$/, /next\.config\./], [
      { title: 'Create Vercel preview', command: 'vercel', approvalRequired: true },
      { title: 'Deploy to Vercel production', command: 'vercel --prod', approvalRequired: true },
    ]),
  ];
}

export interface GitHubService {
  listIssues(): Promise<unknown[]>;
  listPullRequests(): Promise<unknown[]>;
  createReleaseNotes(from: string, to: string): Promise<string>;
}

export class GitHubApiService implements GitHubService {
  constructor(private readonly repository: string, private readonly token: string, private readonly baseUrl = 'https://api.github.com') {}

  async listIssues(): Promise<unknown[]> {
    return await this.get(`/repos/${this.repository}/issues?state=open`) as unknown[];
  }

  async listPullRequests(): Promise<unknown[]> {
    return await this.get(`/repos/${this.repository}/pulls?state=open`) as unknown[];
  }

  async createReleaseNotes(from: string, to: string): Promise<string> {
    const comparison = await this.get(`/repos/${this.repository}/compare/${from}...${to}`) as { commits?: Array<{ commit?: { message?: string } }> };
    return (comparison.commits || []).map((item) => `- ${item.commit?.message || 'Unnamed change'}`).join('\n');
  }

  private async get(route: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${route}`, {
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${this.token}`, 'x-github-api-version': '2022-11-28' },
    });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    return response.json();
  }
}
