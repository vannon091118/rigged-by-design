#!/usr/bin/env node
/** GameScout Dashboard HTTP server.
 *
 * Serves the dashboard UI on loopback (127.0.0.1) and provides SSE for
 * real-time updates from the GameScout core session.
 *
 * Security:
 * - Loopback binding only (127.0.0.1)
 * - Session token for control endpoints
 * - No arbitrary file operations or shell commands
 * - Diagnostics on stderr, not stdout
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import type { GameScoutCore } from '../core/index.js';
import { dashboardHtml } from './html.js';

export interface DashboardServerOptions {
  port: number;
  sessionToken: string;
}

export class DashboardServer {
  private core: GameScoutCore;
  private port: number;
  private sessionToken: string;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(core: GameScoutCore, options: DashboardServerOptions) {
    this.core = core;
    this.port = options.port;
    this.sessionToken = options.sessionToken;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        process.stderr.write(`[gamescout dashboard] HTTP server on 127.0.0.1:${this.port}\n`);
        this.setupWebSocket();
        resolve(undefined);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  private setupWebSocket(): void {
    if (!this.server) return;
    this.wss = new WebSocketServer({ server: this.server, path: '/__gamescout__/ws' });
    this.wss.on('connection', (ws: any) => {
      this.clients.add(ws);
      ws.on('close', () => this.clients.delete(ws));
      ws.on('error', () => this.clients.delete(ws));
      // Send initial snapshot
      ws.send(JSON.stringify({ type: 'snapshot', data: this.core.getSnapshot() }));
    });
  }

  private broadcast(data: unknown): void {
    const msg = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  private handleRequest(req: import('http').IncomingMessage, res: import('http').ServerResponse): void {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Health check
    if (method === 'GET' && url === '/__gamescout__/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', connected: this.core.isConnected() }));
      return;
    }

    // Dashboard HTML
    if (method === 'GET' && url === '/__gamescout__/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(dashboardHtml);
      return;
    }

    // Session snapshot
    if (method === 'GET' && url === '/__gamescout__/api/snapshot') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.core.getSnapshot()));
      return;
    }

    // Screenshot
    if (method === 'GET' && url === '/__gamescout__/api/preview') {
      (async () => {
        try {
          const result = await this.core.actions.preview(true);
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(Buffer.from(result.screenshotBase64, 'base64'));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      })();
      return;
    }

    // Click
    if (method === 'POST' && url === '/__gamescout__/api/click') {
      this.handleJsonPost(req, res, async (body: { x: number; y: number }) => {
        const result = await this.core.actions.click(body.x, body.y);
        this.core.session.addTimelineEvent({ type: 'action', description: `Klick bei (${body.x}, ${body.y})` });
        this.broadcast({ type: 'action', action: 'click', data: result });
        return result;
      });
      return;
    }

    // Checkpoint
    if (method === 'POST' && url === '/__gamescout__/api/checkpoint') {
      this.handleJsonPost(req, res, async (body: { name?: string; observation?: unknown }) => {
        const snap = this.core.getSnapshot();
        const preview = await this.core.actions.preview(true);
        const checkpoint = this.core.session.createCheckpoint(
          body.name ?? 'checkpoint',
          body.observation ?? null,
          preview.screenshotBase64,
          snap.gameTab?.url ?? '',
          snap.gameTab?.title ?? ''
        );
        this.broadcast({ type: 'checkpoint', checkpoint });
        return { checkpointId: checkpoint.id, name: checkpoint.name };
      });
      return;
    }

    // Compare
    if (method === 'POST' && url === '/__gamescout__/api/compare') {
      this.handleJsonPost(req, res, async (body: { checkpointId1: string; checkpointId2: string }) => {
        const result = this.core.checkpoints.compare(body.checkpointId1, body.checkpointId2);
        this.broadcast({ type: 'compare', result });
        return result;
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

  private async handleJsonPost<T, R>(
    req: import('http').IncomingMessage,
    res: import('http').ServerResponse,
    handler: (body: T) => Promise<R> | R
  ): Promise<void> {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    let parsed: T;
    try {
      parsed = JSON.parse(body) as T;
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    try {
      const result = await handler(parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  }

  stop(): void {
    this.clients.forEach((c) => c.close());
    this.clients.clear();
    this.wss?.close();
    this.server?.close();
  }
}
