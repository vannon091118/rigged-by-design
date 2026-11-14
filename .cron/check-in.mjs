#!/usr/bin/env node
// .cron/check-in.mjs
// Prüft und setzt den LOCK auf dem gepinnten State-Issue #677.
// Exit 0 = Lock erlangt, Lauf darf starten.
// Exit 1 = Lock aktiv (anderer Lauf läuft), Abbruch.
// Exit 2 = Fehler bei API-Aufruf.
import { request } from 'node:https';

const API = 'https://api.github.com/repos/vannon091118/rigged-by-design';
const TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = 677;
const LOCK_TTL_MS = 15 * 60 * 1000; // 15 Minuten
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
        // Retry bei Rate-Limit oder Server-Fehlern
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
        // Retry bei Rate-Limit oder Server-Fehlern
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
  try {
    const issue = await apiGet(`/issues/${ISSUE_NUMBER}`);
    const body = issue.body || '';
    const now = new Date();

    const lockMatch = body.match(/^LOCKED_AT:\s*(.+)$/m);
    if (lockMatch) {
      const lockTime = new Date(lockMatch[1].trim());
      if (!isNaN(lockTime.getTime()) && (now - lockTime) < LOCK_TTL_MS) {
        console.log('BUSY: Lock aktiv seit ' + lockTime.toISOString());
        process.exit(1);
      }
    }

    const lines = body.split('\n').filter(l => !l.trim().startsWith('LOCKED_AT:'));
    lines.push(`LOCKED_AT: ${now.toISOString()}`);
    const newBody = lines.join('\n');

    await apiPatch(`/issues/${ISSUE_NUMBER}`, { body: newBody });
    console.log('LOCKED: ' + now.toISOString());
    process.exit(0);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(2);
  }
}

main();
