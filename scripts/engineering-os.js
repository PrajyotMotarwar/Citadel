#!/usr/bin/env node

'use strict';

const path = require('path');

function usage() {
  console.log([
    'Usage:',
    '  node scripts/engineering-os.js plan "<natural language task>"',
    '  node scripts/engineering-os.js run "<natural language task>"',
    '',
    'Build first with: npm run os:build',
  ].join('\n'));
}

async function main() {
  const [command, ...parts] = process.argv.slice(2);
  const prompt = parts.join(' ').trim();
  if (!['plan', 'run'].includes(command) || !prompt) {
    usage();
    process.exitCode = 1;
    return;
  }

  let os;
  try {
    os = require('../packages/engineering-os/dist');
  } catch {
    console.error('Engineering OS is not built. Run: npm run os:build');
    process.exitCode = 1;
    return;
  }

  const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const taskStore = new os.JsonTaskStore(projectRoot);
  const memory = new os.MarkdownCompatibleMemoryStore(projectRoot);
  const providers = new os.ProviderRouter(os.createDefaultProviders());
  const logger = new os.JsonLogger((line) => process.stderr.write(`${line}\n`));
  const platform = new os.EngineeringOperatingSystem({ taskStore, memory, providers, logger });

  if (command === 'plan') {
    console.log(JSON.stringify(platform.plan(prompt, projectRoot), null, 2));
    return;
  }

  const result = await platform.run(prompt, projectRoot);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
