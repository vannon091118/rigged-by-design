#!/usr/bin/env node
/** GameScout MCP server.
 *
 * Exposes GameScout Core tools over MCP STDIO for Hermes and other
 * MCP-compatible agents. All actions target gamePage explicitly.
 * Diagnostics go to stderr, never stdout.
 */

import { McpServer as McpServerBase } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { GameScoutCore } from '../core/index.js';
import type { RecordedAction } from '../core/types.js';

export class McpServer {
  private server: McpServerBase;
  private core: GameScoutCore;

  constructor(core: GameScoutCore) {
    this.core = core;
    this.server = new McpServerBase({
      name: 'gamescout-cdp',
      version: '1.0.0',
    });
    this.registerTools();
  }

  private registerTools(): void {
    // connect
    this.server.tool(
      'connect',
      'Stellt die CDP-Verbindung zum bestehenden Chrome her und wählt den Game-Tab.',
      {},
      async () => {
        try {
          await this.core.connect();
          const snap = this.core.getSnapshot();
          return {
            content: [{ type: 'text', text: JSON.stringify({ connected: true, cdpEndpoint: this.core.options.cdpEndpoint, pageUrl: snap.gameTab?.url, pageTitle: snap.gameTab?.title }, null, 2) }],
          };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ connected: false, error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // get_preview
    this.server.tool(
      'get_preview',
      'Erstellt einen Vollseiten-Screenshot des Game-Tabs.',
      { fullPage: z.boolean().optional().describe('Vollseiten-Screenshot (true) oder Viewport (false). Default: true.') },
      async ({ fullPage } = { fullPage: true }) => {
        try {
          const result = await this.core.actions.preview(fullPage !== false);
          return { content: [{ type: 'image', data: result.screenshotBase64, mimeType: 'image/png' }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // click
    this.server.tool(
      'click',
      'Führt einen Mausklick auf dem Game-Tab bei den angegebenen Koordinaten aus.',
      { x: z.number().describe('X-Koordinate'), y: z.number().describe('Y-Koordinate') },
      async ({ x, y }) => {
        try {
          const result = await this.core.actions.click(x, y);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // press_key
    this.server.tool(
      'press_key',
      'Drückt eine Taste auf dem Game-Tab.',
      { key: z.string().describe('Taste (z. B. "Enter", "Escape", "ArrowLeft", "a")') },
      async ({ key }) => {
        try {
          const result = await this.core.actions.pressKey(key);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // inspect
    this.server.tool(
      'inspect',
      'Inspektiert das Element an der angegebenen Position auf dem Game-Tab.',
      { x: z.number().describe('X-Koordinate'), y: z.number().describe('Y-Koordinate') },
      async ({ x, y }) => {
        try {
          const result = await this.core.actions.inspect(x, y);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // annotate
    this.server.tool(
      'annotate',
      'Markiert einen rechteckigen Bereich auf dem Game-Tab und gibt ein Screenshot zurück.',
      { x: z.number(), y: z.number(), width: z.number(), height: z.number(), label: z.string().optional().describe('Beschriftung') },
      async ({ x, y, width, height, label }) => {
        try {
          const result = await this.core.actions.annotate(x, y, width, height, label);
          return {
            content: [
              { type: 'text', text: JSON.stringify({ annotated: true, x: result.x, y: result.y, width: result.width, height: result.height, label: result.label, description: result.description }, null, 2) },
              { type: 'image', data: result.screenshotBase64, mimeType: 'image/png' },
            ],
          };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // record_start
    this.server.tool(
      'record_start',
      'Startet die Aufzeichnung von Browser-Aktionen.',
      {},
      async () => {
        this.core.recording.startRecording();
        return { content: [{ type: 'text', text: JSON.stringify({ recording: true, actionCount: 0 }, null, 2) }] };
      },
    );

    // record_stop
    this.server.tool(
      'record_stop',
      'Stoppt die Aufzeichnung und gibt die Aktionliste zurück.',
      {},
      async () => {
        const actions = this.core.recording.stopRecording();
        return { content: [{ type: 'text', text: JSON.stringify({ recording: false, actionCount: actions.length, actions }, null, 2) }] };
      },
    );

    // replay
    this.server.tool(
      'replay',
      'Wiedergabe einer aufgezeichneten Aktionliste mit Pre-Conditions und Checkpoints.',
      { actions: z.array(z.object({ type: z.string(), data: z.any() })).optional().describe('Aufgezeichnete Aktionen') },
      async ({ actions }: { actions?: any[] } = { actions: [] }) => {
        try {
          const result = await this.core.recording.replay(actions);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ replayed: 0, error: err instanceof Error ? err.message : String(err), inconclusive: true }, null, 2) }], isError: true };
        }
      },
    );

    // checkpoint
    this.server.tool(
      'checkpoint',
      'Speichert einen Checkpoint: Screenshot plus optionale Beobachtungsdaten.',
      { name: z.string().optional(), observation: z.string().optional().describe('JSON-String mit Beobachtungsdaten') },
      async ({ name, observation } = { name: '', observation: '' }) => {
        try {
          const snap = this.core.getSnapshot();
          const preview = await this.core.actions.preview(true);
          const obs = observation ? JSON.parse(observation) : null;
          const checkpoint = this.core.session.createCheckpoint(
            name ?? 'checkpoint',
            obs,
            preview.screenshotBase64,
            snap.gameTab?.url ?? '',
            snap.gameTab?.title ?? ''
          );
          return { content: [{ type: 'text', text: JSON.stringify({ checkpointId: checkpoint.id, name: checkpoint.name, timestamp: checkpoint.timestamp }, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );

    // compare
    this.server.tool(
      'compare',
      'Vergleicht zwei Checkpoints mit Pixel-Diff.',
      { checkpointId1: z.string(), checkpointId2: z.string() },
      async ({ checkpointId1, checkpointId2 }) => {
        try {
          const cp1 = this.core.checkpoints.getCheckpoint(checkpointId1);
          const cp2 = this.core.checkpoints.getCheckpoint(checkpointId2);
          if (!cp1 || !cp2) {
            return { content: [{ type: 'text', text: JSON.stringify({ compared: false, error: 'Checkpoint nicht gefunden' }, null, 2) }], isError: true };
          }
          const result = this.core.checkpoints.compare(checkpointId1, checkpointId2);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return { content: [{ type: 'text', text: JSON.stringify({ compared: false, error: err instanceof Error ? err.message : String(err) }, null, 2) }], isError: true };
        }
      },
    );
  }

  async connect(transport: StdioServerTransport): Promise<void> {
    await this.server.connect(transport);
  }
}
