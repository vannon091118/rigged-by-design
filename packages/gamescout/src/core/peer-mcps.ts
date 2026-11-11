/** Optional, read-only bridge to the repository owner's configured MCP peers. */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { parse } from 'yaml';

export type PeerMcpName = 'chrome-devtools' | 'pixijs';

type PeerConfig = {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
};

type ConnectedPeer = {
  client: Client;
  transport: StdioClientTransport;
  tools: Map<string, { description: string; inputSchema: Record<string, unknown> }>;
};

const PEER_NAMES: PeerMcpName[] = ['chrome-devtools', 'pixijs'];
const READ_ONLY_TOOLS: Record<PeerMcpName, Set<string>> = {
  'chrome-devtools': new Set([
    'list_pages',
    'list_console_messages',
    'get_console_message',
    'list_network_requests',
    'get_network_request',
    'take_screenshot',
    'performance_analyze_insight',
  ]),
  pixijs: new Set([
    'check_connection',
    'get_app_info',
    'get_ticker',
    'count_nodes',
    'get_scene_tree',
    'get_node',
    'find_nodes',
    'get_screenshot',
  ]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function configCandidates(): string[] {
  const localAppData = process.env.LOCALAPPDATA;
  return [
    process.env.GAMESCOUT_MCP_CONFIG,
    process.env.HERMES_CONFIG,
    localAppData ? join(localAppData, 'hermes', 'config.yaml') : undefined,
    join(homedir(), '.hermes', 'config.yaml'),
  ].filter((candidate): candidate is string => Boolean(candidate));
}

function readPeerConfigs(): { path: string | null; configs: Partial<Record<PeerMcpName, PeerConfig>> } {
  const path = configCandidates().find((candidate) => existsSync(candidate));
  if (!path) return { path: null, configs: {} };

  const parsed: unknown = parse(readFileSync(path, 'utf8'));
  if (!isRecord(parsed) || !isRecord(parsed.mcp_servers)) return { path, configs: {} };

  const configs: Partial<Record<PeerMcpName, PeerConfig>> = {};
  for (const name of PEER_NAMES) {
    const entry = parsed.mcp_servers[name];
    if (!isRecord(entry) || typeof entry.command !== 'string' || !entry.command.trim()) continue;
    const env: Record<string, string> = {};
    if (isRecord(entry.env)) {
      for (const [key, value] of Object.entries(entry.env)) {
        if (typeof value === 'string') env[key] = value;
      }
    }
    configs[name] = {
      command: entry.command,
      args: Array.isArray(entry.args) ? entry.args.filter((arg): arg is string => typeof arg === 'string') : [],
      env,
      ...(typeof entry.cwd === 'string' ? { cwd: entry.cwd } : {}),
    };
  }
  return { path, configs };
}

function windowsCommand(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform !== 'win32' || !/^(?:npx|npm|pnpm|yarn)(?:\.cmd)?$/i.test(command)) {
    return { command, args };
  }

  const quote = (value: string): string => {
    if (/[\r\n%!]/.test(value)) throw new Error('MCP peer args contain unsupported shell characters.');
    return `"${value.replace(/[&|<>^]/g, '^$&').replace(/"/g, '""')}"`;
  };
  const commandLine = [command, ...args].map(quote).join(' ');
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', commandLine] };
}

export interface PeerToolSummary {
  peer: PeerMcpName;
  connected: boolean;
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
  error?: string;
}

export class PeerMcpManager {
  private gameUrl?: string;
  private connected = new Map<PeerMcpName, ConnectedPeer>();
  private connecting = new Map<PeerMcpName, Promise<ConnectedPeer>>();
  private config: ReturnType<typeof readPeerConfigs> | null = null;

  constructor(gameUrl?: string) {
    this.gameUrl = gameUrl;
  }

  async listReadOnlyTools(peerName?: PeerMcpName): Promise<PeerToolSummary[]> {
    const names = peerName ? [peerName] : PEER_NAMES;
    const summaries: PeerToolSummary[] = [];
    for (const name of names) {
      try {
        const peer = await this.connectPeer(name);
        summaries.push({
          peer: name,
          connected: true,
          tools: [...peer.tools.entries()]
            .filter(([toolName]) => READ_ONLY_TOOLS[name].has(toolName))
            .map(([toolName, tool]) => ({ name: toolName, ...tool })),
        });
      } catch (error) {
        summaries.push({
          peer: name,
          connected: false,
          tools: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return summaries;
  }

  async callReadOnlyTool(
    peerName: PeerMcpName,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<Awaited<ReturnType<Client['callTool']>>> {
    if (!READ_ONLY_TOOLS[peerName]?.has(toolName)) {
      throw new Error(`Peer tool '${peerName}.${toolName}' is not enabled for read-only player QA.`);
    }
    const peer = await this.connectPeer(peerName);
    if (!peer.tools.has(toolName)) throw new Error(`Configured peer '${peerName}' does not expose '${toolName}'.`);
    return peer.client.callTool({ name: toolName, arguments: args }, undefined, { timeout: 8000, maxTotalTimeout: 12000 });
  }

  async close(): Promise<void> {
    const peers = [...this.connected.values()];
    this.connected.clear();
    this.connecting.clear();
    await Promise.allSettled(peers.map((peer) => peer.client.close()));
  }

  private async connectPeer(name: PeerMcpName): Promise<ConnectedPeer> {
    const current = this.connected.get(name);
    if (current) return current;
    const underway = this.connecting.get(name);
    if (underway) return underway;

    const connection = this.openPeer(name);
    this.connecting.set(name, connection);
    try {
      const peer = await connection;
      this.connected.set(name, peer);
      return peer;
    } finally {
      this.connecting.delete(name);
    }
  }

  private async openPeer(name: PeerMcpName): Promise<ConnectedPeer> {
    this.config ??= readPeerConfigs();
    const config = this.config.configs[name];
    if (!config) {
      throw new Error(`Peer '${name}' is not configured in the local Hermes MCP config.`);
    }

    const env = { ...getDefaultEnvironment(), ...config.env };
    if (name === 'pixijs') {
      env.PIXI_APP_EXPR ??= 'window.__pixiApp';
      if (this.gameUrl) env.PIXI_URL ??= this.gameUrl;
    }
    const launch = windowsCommand(config.command, config.args);
    const transport = new StdioClientTransport({
      ...launch,
      env,
      cwd: config.cwd,
      stderr: 'ignore',
      maxBufferSize: 4_000_000,
    });
    const client = new Client({ name: `gamescout-peer-${name}`, version: '1.0.0' });
    try {
      await client.connect(transport);
      const listed = await client.listTools({}, { timeout: 15000, maxTotalTimeout: 20000 });
      const tools = new Map<string, { description: string; inputSchema: Record<string, unknown> }>();
      for (const tool of listed.tools) {
        tools.set(tool.name, {
          description: tool.description ?? '',
          inputSchema: tool.inputSchema,
        });
      }
      return { client, transport, tools };
    } catch (error) {
      await client.close().catch(() => {});
      throw new Error(`Could not connect to configured '${name}' MCP peer: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }
}
