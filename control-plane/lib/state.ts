import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.CITADEL_PROJECT_ROOT || path.join(process.cwd(), '..'));

async function countFiles(relative: string): Promise<number> {
  try {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).length;
  } catch {
    return 0;
  }
}

async function readJsonFiles(relative: string, limit = 20): Promise<unknown[]> {
  try {
    const directory = path.join(root, relative);
    const entries = await readdir(directory);
    const files = await Promise.all(entries.filter((entry) => entry.endsWith('.json')).map(async (entry) => ({
      entry,
      modified: (await stat(path.join(directory, entry))).mtimeMs,
    })));
    return await Promise.all(files.sort((a, b) => b.modified - a.modified).slice(0, limit).map(async ({ entry }) => {
      try {
        return JSON.parse(await readFile(path.join(directory, entry), 'utf8'));
      } catch {
        return null;
      }
    }));
  } catch {
    return [];
  }
}

export async function getControlPlaneState() {
  const [campaigns, fleet, tasks, memory, approvals, telemetry] = await Promise.all([
    countFiles('.planning/campaigns'),
    countFiles('.planning/fleet'),
    readJsonFiles('.planning/engineering-os/tasks'),
    countFiles('.planning/memory/records'),
    countFiles('.planning/approvals'),
    countFiles('.planning/telemetry'),
  ]);
  return {
    project: path.basename(root),
    root,
    generatedAt: new Date().toISOString(),
    metrics: { campaigns, fleet, tasks: tasks.length, memory, approvals, telemetry },
    tasks,
    providers: [
      ['OpenAI', Boolean(process.env.OPENAI_API_KEY)],
      ['Claude', Boolean(process.env.ANTHROPIC_API_KEY)],
      ['Gemini', Boolean(process.env.GEMINI_API_KEY)],
      ['DeepSeek', Boolean(process.env.DEEPSEEK_API_KEY)],
      ['Grok', Boolean(process.env.XAI_API_KEY)],
    ],
    team: ['Architect', 'Backend', 'Frontend', 'QA', 'DevOps', 'Security', 'Documentation'],
  };
}
