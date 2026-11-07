#!/usr/bin/env node
/** ERR-0911: entfernt verbotene Trailer und Tool-Werbung aus einer Nachricht. */
import { readFileSync, writeFileSync } from 'node:fs';

const FORBIDDEN = /Co-authored-by:|Generated with|\bFreebuff\b|\bCodebuff\b|\bClaude\b|\bAnthropic\b|\bOpenAI\b|\bCursor\b|Signed-off-by:|\[(?:Codebuff|Freebuff)\]/i;
const file = process.argv[2];
if (!file) {
  console.error('sanitize-commit: Pfad zur Commit-Nachricht fehlt');
  process.exit(1);
}
const text = readFileSync(file, 'utf8');
const cleaned = text.split(/\r?\n/).filter((line) => !FORBIDDEN.test(line)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
if (cleaned !== text.trim()) {
  writeFileSync(file, `${cleaned}\n`);
  console.log('[IDX-0001] [ERR-0911-AUTOFIXED] sanitize-commit: Trailer entfernt');
} else {
  console.log('sanitize-commit: PASS, keine Trailer');
}
