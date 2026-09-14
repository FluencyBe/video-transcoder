import { Rendition } from './renditions';

/**
 * Builds the master HLS playlist referencing each rendition's variant
 * playlist by the R2 storage layout's relative path convention
 * (`{rendition}/playlist.m3u8`, see ADR 0008). Renditions are emitted in
 * input order — callers pass RENDITIONS (highest quality first) so players
 * that don't do bandwidth probing default sensibly.
 */
export function buildMasterManifest(renditions: Rendition[]): string {
  if (renditions.length === 0) {
    throw new Error('buildMasterManifest requires at least one rendition');
  }

  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];

  for (const rendition of renditions) {
    const bandwidthBps = (rendition.maxrateKbps + rendition.audioBitrateKbps) * 1000;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthBps},RESOLUTION=${rendition.width}x${rendition.height}`);
    lines.push(`${rendition.name}/playlist.m3u8`);
  }

  return lines.join('\n') + '\n';
}
