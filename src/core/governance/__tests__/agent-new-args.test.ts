/** @test-target: scripts/lib/agent-new-args.mjs */
/** @error-code: ERR-4019 */
import { describe, expect, it } from 'vitest';
import { parseAgentNewArgs } from '../../../../scripts/lib/agent-new-args.mjs';

describe('agent:new option parsing', () => {
  it('keeps commas in scalar task and goal values', () => {
    const parsed = parseAgentNewArgs(['--task', 'Inspect, repair, verify', '--goal=Keep, preserve, explain']);
    expect(parsed.arg('task')).toBe('Inspect, repair, verify');
    expect(parsed.arg('goal')).toBe('Keep, preserve, explain');
  });

  it('splits only allowlist values into separate paths', () => {
    const parsed = parseAgentNewArgs(['--allow', 'scripts/, docs/', '--allow=src/core/**']);
    expect(parsed.values('allow')).toEqual(['scripts/', 'docs/', 'src/core/**']);
  });
});
