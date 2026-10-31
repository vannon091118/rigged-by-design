/**
 * Wegwerf-Branches: alles, was auf `main` liegt und nicht `main` ist.
 *
 * Nach einer Session, die gemergt wurde, bleibt weder lokal noch auf GitHub
 * ein Zweig zurueck; nur offene, nicht gemergte Arbeit bleibt bestehen. Der
 * Upstream-Zustand wird deshalb nur noch angezeigt, nicht mehr verlangt:
 * gemergt heisst weg.
 */
export const PROTECTED = Object.freeze(['main']);

/**
 * Liest `git for-each-ref --format='%(refname:short)%09%(upstream:track)'`.
 * `[gone]` heisst: der Remote-Zweig existiert nicht mehr, der Branch ist also
 * nach dem Merge uebrig geblieben.
 */
export function parseBranches(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = '', track = ''] = line.split('\t');
      return { name, upstreamGone: track.includes('[gone]') };
    })
    .filter((branch) => branch.name.length > 0);
}

/** Kandidaten zum Loeschen: gemergt, nicht geschuetzt, nicht der aktuelle Branch. */
export function prunable(branches, options = {}) {
  const protectedNames = options.protected ?? PROTECTED;
  const current = options.current ?? '';
  return branches
    .filter((branch) => branch.merged)
    .filter((branch) => !protectedNames.includes(branch.name))
    .filter((branch) => branch.name !== current)
    .map((branch) => branch.name);
}
