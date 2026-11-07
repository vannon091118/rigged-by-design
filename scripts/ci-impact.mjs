#!/usr/bin/env node
/** Emit delivery switches from the shared impact and test-catalog plan. */
import { appendFileSync } from 'node:fs';
import { impact } from './lib/impact.mjs';

const baseArg = process.argv.slice(2).find((arg) => arg.startsWith('--base='));
const baseRef = baseArg?.slice('--base='.length) || 'origin/main';
const plan = impact({ profile: 'quick', baseRef });
const outputs = {
  build: String(plan.delivery.build),
  audit: String(plan.delivery.dependenciesChanged),
  advisory: String(plan.delivery.advisoryTests.length > 0),
  long_files: plan.delivery.advisoryTests.map((entry) => entry.file).join(','),
  changed: plan.changed.join(','),
};

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
}
console.log(JSON.stringify({ baseRef, ...plan.delivery, changed: plan.changed }, null, 2));
