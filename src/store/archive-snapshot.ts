/** Archiv-Projektion: kopiert nur, wenn das Archiv gewachsen oder verschoben wurde. */
import type { JournalEvent } from '../core/sim/journal';

let cache: { source: readonly unknown[]; length: number; lastId: number; copy: JournalEvent[] } | null = null;

export function archiveSnapshot(archive: JournalEvent[]): JournalEvent[] {
  const lastId = archive.length ? archive[archive.length - 1]!.id : -1;
  if (cache && cache.source === archive && cache.length === archive.length && cache.lastId === lastId) {
    return cache.copy;
  }
  const copy = archive.map((event) => ({ ...event, refs: event.refs ? { ...event.refs } : undefined }));
  cache = { source: archive, length: archive.length, lastId, copy };
  return copy;
}
