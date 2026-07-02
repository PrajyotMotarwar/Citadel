import type { LlmProvider, ProviderId, ProviderRequest, ProviderResponse } from './contracts';

interface HttpProviderOptions {
  id: ProviderId;
  apiKey?: string;
  baseUrl: string;
  defaultModel: string;
  headers?: Record<string, string>;
  requestShape: (request: ProviderRequest, model: string) => unknown;
  responseText: (payload: unknown) => string;
}

export class HttpLlmProvider implements LlmProvider {
  readonly id: ProviderId;

  constructor(private readonly options: HttpProviderOptions) {
    this.id = options.id;
  }

  isAvailable(): boolean {
    return Boolean(this.options.apiKey);
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    if (!this.options.apiKey) throw new Error(`${this.id} provider is not configured`);
    const model = request.model || this.options.defaultModel;
    const started = Date.now();
    const response = await fetch(this.options.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
        ...this.options.headers,
      },
      body: JSON.stringify(this.options.requestShape(request, model)),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${this.id} request failed (${response.status}): ${body.slice(0, 500)}`);
    }
    const payload = await response.json();
    return {
      provider: this.id,
      model,
      content: this.options.responseText(payload),
      latencyMs: Date.now() - started,
    };
  }
}

const openAiShape = (request: ProviderRequest, model: string) => ({
  model,
  messages: [
    ...(request.system ? [{ role: 'system', content: request.system }] : []),
    { role: 'user', content: request.prompt },
  ],
  temperature: request.temperature ?? 0.2,
  max_tokens: request.maxTokens,
});

const openAiText = (payload: unknown): string => {
  const data = payload as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || '';
};

export function createDefaultProviders(env: NodeJS.ProcessEnv = process.env): LlmProvider[] {
  return [
    new HttpLlmProvider({
      id: 'openai',
      apiKey: env.OPENAI_API_KEY,
      baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      defaultModel: env.OPENAI_MODEL || 'gpt-4.1',
      requestShape: openAiShape,
      responseText: openAiText,
    }),
    new HttpLlmProvider({
      id: 'anthropic',
      apiKey: env.ANTHROPIC_API_KEY,
      baseUrl: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages',
      defaultModel: env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      headers: { 'anthropic-version': '2023-06-01', 'x-api-key': env.ANTHROPIC_API_KEY || '' },
      requestShape: (request, model) => ({
        model,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.2,
      }),
      responseText: (payload) => {
        const data = payload as { content?: Array<{ text?: string }> };
        return data.content?.map((item) => item.text || '').join('') || '';
      },
    }),
    new HttpLlmProvider({
      id: 'google',
      apiKey: env.GEMINI_API_KEY,
      baseUrl: env.GEMINI_BASE_URL || `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      defaultModel: env.GEMINI_MODEL || 'gemini-2.5-pro',
      requestShape: openAiShape,
      responseText: openAiText,
    }),
    new HttpLlmProvider({
      id: 'deepseek',
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions',
      defaultModel: env.DEEPSEEK_MODEL || 'deepseek-chat',
      requestShape: openAiShape,
      responseText: openAiText,
    }),
    new HttpLlmProvider({
      id: 'xai',
      apiKey: env.XAI_API_KEY,
      baseUrl: env.XAI_BASE_URL || 'https://api.x.ai/v1/chat/completions',
      defaultModel: env.XAI_MODEL || 'grok-3',
      requestShape: openAiShape,
      responseText: openAiText,
    }),
  ];
}

export class ProviderRouter {
  constructor(private readonly providers: LlmProvider[]) {}

  select(input: { task: string; preferred?: ProviderId; requireLongContext?: boolean; costSensitive?: boolean }): LlmProvider {
    const available = this.providers.filter((provider) => provider.isAvailable());
    if (available.length === 0) throw new Error('No LLM provider is configured');
    if (input.preferred) {
      const preferred = available.find((provider) => provider.id === input.preferred);
      if (preferred) return preferred;
    }

    const task = input.task.toLowerCase();
    const priorities: ProviderId[] = task.match(/security|architecture|incident|reason/)
      ? ['anthropic', 'openai', 'google', 'deepseek', 'xai']
      : input.requireLongContext
        ? ['google', 'anthropic', 'openai', 'xai', 'deepseek']
        : input.costSensitive
          ? ['deepseek', 'google', 'openai', 'anthropic', 'xai']
          : ['openai', 'anthropic', 'google', 'deepseek', 'xai'];

    return priorities.map((id) => available.find((provider) => provider.id === id)).find(Boolean) as LlmProvider;
  }
}
