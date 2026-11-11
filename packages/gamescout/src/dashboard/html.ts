/** GameScout Dashboard HTML.
 *
 * Single-file HTML dashboard served from the GameScout HTTP server.
 * Connects via WebSocket for real-time updates.
 * No React, no build step, pure HTML/JS/CSS.
 */

export const dashboardHtml = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GameScout Dashboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0c; color: #e0e0e0; line-height: 1.5; }
  .header { background: #16161a; border-bottom: 1px solid #2a2a2e; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 1.1rem; color: #ffffff; }
  .status { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; }
  .status-indicator { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }
  .status-indicator.connected { background: #22c55e; }
  .status-indicator.disconnected { background: #ef4444; }
  .status-indicator.connecting { background: #f59e0b; }
  .container { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.5rem; }
  .panel { background: #16161a; border: 1px solid #2a2a2e; border-radius: 8px; padding: 1rem; }
  .panel h2 { font-size: 0.95rem; margin-bottom: 0.75rem; color: #ffffff; border-bottom: 1px solid #2a2a2e; padding-bottom: 0.4rem; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .full-width { grid-column: 1 / -1; }
  .value-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #2a2a2e; font-size: 0.85rem; }
  .value-row:last-child { border-bottom: none; }
  .label { color: #9ca3af; }
  .value { color: #e0e0e0; font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; }
  .value.ok { color: #22c55e; }
  .value.error { color: #ef4444; }
  .value.warning { color: #f59e0b; }
  .btn { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem; margin: 0.2rem 0.2rem 0.2rem 0; }
  .btn:hover { background: #3b82f6; }
  .btn:disabled { background: #4b5563; cursor: not-allowed; }
  .btn-danger { background: #dc2626; }
  .btn-danger:hover { background: #ef4444; }
  .btn-success { background: #059669; }
  .btn-success:hover { background: #10b981; }
  .screenshot { width: 100%; max-width: 400px; border: 1px solid #2a2a2e; border-radius: 4px; margin: 0.5rem 0; }
  .timeline { max-height: 300px; overflow-y: auto; font-size: 0.8rem; }
  .timeline-entry { padding: 0.4rem 0; border-bottom: 1px solid #2a2a2e; display: flex; justify-content: space-between; }
  .timeline-entry:last-child { border-bottom: none; }
  .timeline-time { color: #6b7280; font-family: monospace; font-size: 0.7rem; }
  .timeline-type { font-size: 0.7rem; text-transform: uppercase; color: #9ca3af; font-weight: bold; }
  .timeline-desc { color: #e0e0e0; flex: 1; margin: 0 0.5rem; }
  .compare-result { background: #1f1f23; border-radius: 4px; padding: 0.75rem; margin: 0.5rem 0; }
  .compare-row { display: flex; justify-content: space-between; padding: 0.3rem 0; }
  .empty { color: #9ca3af; font-style: italic; padding: 1rem; text-align: center; }
  .token-box { background: #1f1f23; border-radius: 4px; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; word-break: break-all; margin: 0.5rem 0; }
</style>
</head>
<body>
  <div class="header">
    <h1>\ud83d\udee0\ufe0f GameScout Dashboard</h1>
    <div class="status">
      <span class="status-indicator disconnected" id="statusIndicator"></span>
      <span id="statusText">Nicht verbunden</span>
    </div>
  </div>

  <div class="container grid-2">
    <div class="panel full-width">
      <h2>Session Overview</h2>
      <div class="value-row"><span class="label">CDP-Endpunkt</span><span class="value" id="valCdpEndpoint">-</span></div>
      <div class="value-row"><span class="label">Game-Tab URL</span><span class="value" id="valGameUrl">-</span></div>
      <div class="value-row"><span class="label">Game-Tab Titel</span><span class="value" id="valGameTitle">-</span></div>
      <div class="value-row"><span class="label">Viewport</span><span class="value" id="valViewport">-</span></div>
      <div class="value-row"><span class="label">Dashboard-Port</span><span class="value" id="valDashboardPort">-</span></div>
      <div class="value-row"><span class="label">Session-ID</span><span class="value" id="valSessionId">-</span></div>
      <div class="value-row"><span class="label">Aufnahme</span><span class="value" id="valRecording">\u274c</span></div>
      <div class="value-row"><span class="label">Letzter Fehler</span><span class="value" id="valLastError">-</span></div>
    </div>

    <div class="panel grid-2">
      <h2>Session-Steuerung</h2>
      <button class="btn" onclick="apiCall('/__gamescout__/api/preview', {})">Screenshot aufnehmen</button>
      <button class="btn btn-success" onclick="apiCall('/__gamescout__/api/checkpoint', { name: 'Manueller Checkpoint' })">Checkpoint erstellen</button>
      <button class="btn" onclick="location.reload()">Dashboard aktualisieren</button>
      <div class="token-box" id="tokenBox">Session-Token: -</div>
    </div>

    <div class="panel grid-3">
      <h2>Gameplay Overview</h2>
      <div class="empty">Keine Daten verf\u00fcgbar. Starte eine Sitzung.</div>
    </div>

    <div class="panel full-width grid-2">
      <h2>Visual Truth — Screenshot</h2>
      <img class="screenshot" id="screenshotImg" alt="Spiel-Screenshot" style="display:none;">
      <div class="empty" id="screenshotPlaceholder">Kein Screenshot verf\u00fcgbar</div>
    </div>

    <div class="panel full-width grid-2">
      <h2>Render Truth</h2>
      <div class="empty">Render-Daten verf\u00fcgbar sobald Engine-Adapter verbunden sind.</div>
    </div>

    <div class="panel full-width grid-2">
      <h2>Simulation Truth</h2>
      <div class="empty">Simulation-Daten verf\u00fcgbar sobald Runtime-Probe-Adapter verbunden sind.</div>
    </div>

    <div class="panel full-width">
      <h2>Timeline</h2>
      <div class="timeline" id="timeline">
        <div class="empty">Keine Ereignisse</div>
      </div>
    </div>

    <div class="panel grid-2">
      <h2>Recording & Replay</h2>
      <button class="btn btn-success" onclick="apiCall('/__gamescout__/api/record_start', {}, 'POST')">Recording starten</button>
      <button class="btn btn-danger" onclick="apiCall('/__gamescout__/api/record_stop', {}, 'POST')">Recording stoppen</button>
      <button class="btn" onclick="replayLast()">Letzte Aufnahme wiederholen</button>
      <div id="replayResult" class="empty"></div>
    </div>

    <div class="panel grid-2">
      <h2>Compare</h2>
      <div id="compareControls" class="empty">Keine Checkpoints verf\u00fcgbar</div>
      <div id="compareResult" class="compare-result" style="display:none;"></div>
    </div>
  </div>

<script>
  let ws = null;
  let sessionToken = '';

  function log(msg) {
    const tl = document.getElementById('timeline');
    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    entry.innerHTML = \`<span class="timeline-time">\${new Date().toLocaleTimeString()}</span><span class="timeline-desc">\${msg}</span>\`;
    tl.insertBefore(entry, tl.firstChild);
    if (tl.children.length > 100) tl.removeChild(tl.lastChild);
  }

  function updateSnapshot(snap) {
    document.getElementById('valCdpEndpoint').textContent = snap.cdpEndpoint || '-';
    document.getElementById('valGameUrl').textContent = snap.gameTab?.url || '-';
    document.getElementById('valGameTitle').textContent = snap.gameTab?.title || '-';
    document.getElementById('valViewport').textContent = snap.gameTab?.viewport ? \`\${snap.gameTab.viewport.width}x\${snap.gameTab.viewport.height}\\) : '-';
    document.getElementById('valSessionId').textContent = snap.id || '-';
    document.getElementById('valRecording').textContent = snap.recording ? '\u2705 Ja' : '\u274c Nein';
    document.getElementById('valLastError').textContent = snap.lastError || '-';

    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    if (snap.status === 'connected') {
      indicator.className = 'status-indicator connected';
      text.textContent = 'Verbunden';
    } else if (snap.status === 'connecting') {
      indicator.className = 'status-indicator connecting';
      text.textContent = 'Verbindung wird hergestellt';
    } else {
      indicator.className = 'status-indicator disconnected';
      text.textContent = 'Nicht verbunden';
    }
  }

  async function apiCall(path, body = {}, method = 'POST') {
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
      return await res.json();
    } catch (err) {
      log(\u003cspan style="color:#ef4444"\u003eAPI-Fehler: \${err.message}\u003c/span\u003e);
    }
  }

  async function takeScreenshot() {
    const res = await apiCall('/__gamescout__/api/preview', {}, 'GET');
    if (res && res.screenshotBase64) {
      const img = document.getElementById('screenshotImg');
      img.src = \`data:image/png;base64,\${res.screenshotBase64}\`;
      img.style.display = 'block';
      document.getElementById('screenshotPlaceholder').style.display = 'none';
      log('Screenshot aufgenommen');
    }
  }

  async function replayLast() {
    const res = await apiCall('/__gamescout__/api/replay', {}, 'POST');
    const el = document.getElementById('replayResult');
    if (res) {
      el.innerHTML = \`<div>\u2705 Replay: \${res.replayed}/\${res.total} Aktionen, inkonsistent: \${res.inconclusive ? 'Ja' : 'Nein'}</div>\`;
      el.className = res.inconclusive ? 'value warning' : 'value ok';
      log(\`Replay abgeschlossen: \${res.replayed} von \${res.total}\`);
    }
  }

  function connectWs() {
    ws = new WebSocket('ws://127.0.0.1:4321/__gamescout__/ws');
    ws.onopen = () => log('Dashboard-Verbindung hergestellt');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'snapshot') updateSnapshot(msg.data);
      if (msg.type === 'checkpoint') log(\u003cspan style="color:#22c55e"\u003eNeuer Checkpoint: \${msg.checkpoint.name}\u003c/span\u003e);
      if (msg.type === 'compare') {
        const el = document.getElementById('compareResult');
        el.style.display = 'block';
        el.innerHTML = \`
          <div class="compare-row"><span>Pixel-Diff:</span> \${msg.result.pixelDiff.count} Pixel (\${msg.result.pixelDiff.percent}%)</div>
          <div class="compare-row"><span>Screenshot identisch:</span> \${msg.result.screenshotIdentical ? 'Ja' : 'Nein'}</div>
          <div class="compare-row"><span>URL ge\u00e4ndert:</span> \${msg.result.urlChanged ? 'Ja' : 'Nein'}</div>
        \`;
        log('Compare-Ergebnis verf\u00fcgbar');
      }
    };
    ws.onclose = () => {
      log('Dashboard-Verbindung getrennt');
      setTimeout(connectWs, 2000);
    };
  }

  // Initialize
  updateSnapshot({ status: 'disconnected' });
  connectWs();
  setInterval(takeScreenshot, 3000);
  setInterval(async () => {
    try {
      const snap = await apiCall('/__gamescout__/api/snapshot', {}, 'GET');
      if (snap) updateSnapshot(snap);
    } catch {}
  }, 2000);
</script>
</body>
</html>`;
