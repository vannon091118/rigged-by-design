#!/usr/bin/env node
// .cron/check-out.mjs
// Entfernt den LOCK vom gepinnten State-Issue #677 und schreibt den aktuellen state:JSON.
// Aufruf: node .cron/check-out.mjs '<state-json>'
// Exit 0 = erfolgreich.
// Exit 2 = Fehler.
import { request } from 'node:https';

const API = 'https://api.github.com/repos/vannon091118/rigged-by-design';
const TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = 677;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function apiGet(path, attempt = 1) {
  return new Promise((resolve, reject) => {
    const req = request(`${API}${path}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'rbd-maintainer-cron'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 500 || res.statusCode === 429) {
          if (attempt < MAX_RETRIES) {
            setTimeout(() => resolve(apiGet(path, attempt + 1)), RETRY_DELAY_MS * attempt);
            return;
          }
        }
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', err => {
      if (attempt < MAX_RETRIES) {
        setTimeout(() => resolve(apiGet(path, attempt + 1)), RETRY_DELAY_MS * attempt);
        return;
      }
      reject(err);
    });
    req.end();
  });
}

function apiPatch(path, body, attempt = 1) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = request(`${API}${path}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'rbd-maintainer-cron',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        if (res.statusCode >= 500 || res.statusCode === 429) {
          if (attempt < MAX_RETRIES) {
            setTimeout(() => resolve(apiPatch(path, body, attempt + 1)), RETRY_DELAY_MS * attempt);
            return;
          }
        }
        resolve(d);
      });
    });
    req.on('error', err => {
      if (attempt < MAX_RETRIES) {
        setTimeout(() => resolve(apiPatch(path, body, attempt + 1)), RETRY_DELAY_MS * attempt);
        return;
      }
      reject(err);
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  if (!TOKEN) {
    console.error('ERROR: GITHUB_TOKEN nicht gesetzt');
    process.exit(2);
  }
  const newStateJson = process.argv[2];
  if (!newStateJson) {
    console.error('Usage: node .cron/check-out.mjs <state-json>');
    process.exit(2);
  }
  try {
    const issue = await apiGet(`/issues/${ISSUE_NUMBER}`);
    let body = issue.body || '';

    // LOCKED_AT entfernen
    body = body.split('\n').filter(l => !l.trim().startsWith('LOCKED_AT:')).join('\n');

    // state:JSON Block ersetzen oder anfügen
    const marker = '```json\n';
    const endMarker = '\n```';

    if (body.includes(marker)) {
      const before = body.split(marker)[0];
      const rest = body.split(endMarker).slice(1).join(endMarker);
      body = before + marker + newStateJson + endMarker + rest;
    } else {
      body += '\n\n## state:JSON\n\n' + marker + newStateJson + endMarker;
    }

    await apiPatch(`/issues/${ISSUE_NUMBER}`, { body });
    console.log('UNLOCKED: State geschrieben');
    process.exit(0);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(2);
  }
}

main();
