/**
 * WebP-Kodierung der Atlasseiten ueber das bereits vorhandene `ffmpeg-static`.
 * Die PNG-Seiten kosten zusammen 1.040.593 B; WebP-q95 kostet 394.592 B bei
 * visuell identischem 2x-Crop. libwebp ist deterministisch: zwei Laeufe
 * liefern byte-identische Dateien. q95 ist bewusst keine Lossless-Kodierung;
 * Lossless-WebP waere mit 660.484 B nur rund ein Drittel kleiner als PNG.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import ffmpegPath from 'ffmpeg-static';

export const WEBP_QUALITY = 95;

export function encodeWebp(pngFile, webpFile) {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static fehlt; `pnpm rebuild ffmpeg-static` ausfuehren.');
  }
  const result = spawnSync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', pngFile,
    '-c:v', 'libwebp', '-q:v', String(WEBP_QUALITY), '-compression_level', '6',
    '-map_metadata', '-1',
    webpFile,
  ], { stdio: 'inherit' });
  if (result.error) throw new Error(`ffmpeg startet nicht: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`WebP-Kodierung fehlgeschlagen (${result.status}): ${pngFile}`);
}
