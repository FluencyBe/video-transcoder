import { buildMasterManifest } from '../manifest';
import { Rendition } from '../renditions';

const RENDITIONS: Rendition[] = [
  { name: '1080p', width: 1920, height: 1080, crf: 21, maxrateKbps: 4500, bufsizeKbps: 9000, audioBitrateKbps: 128 },
  { name: '720p', width: 1280, height: 720, crf: 23, maxrateKbps: 2500, bufsizeKbps: 5000, audioBitrateKbps: 128 },
  { name: '480p', width: 854, height: 480, crf: 25, maxrateKbps: 1000, bufsizeKbps: 2000, audioBitrateKbps: 96 },
];

describe('buildMasterManifest', () => {
  it('starts with the required HLS header tags', () => {
    const manifest = buildMasterManifest(RENDITIONS);
    const lines = manifest.split('\n');

    expect(lines[0]).toBe('#EXTM3U');
    expect(lines[1]).toBe('#EXT-X-VERSION:3');
  });

  it('emits one EXT-X-STREAM-INF + variant URI pair per rendition, in input order', () => {
    const manifest = buildMasterManifest(RENDITIONS);
    const lines = manifest.trim().split('\n');

    // header (2) + 3 renditions * 2 lines each
    expect(lines).toHaveLength(2 + RENDITIONS.length * 2);

    expect(lines[2]).toBe('#EXT-X-STREAM-INF:BANDWIDTH=4628000,RESOLUTION=1920x1080');
    expect(lines[3]).toBe('1080p/playlist.m3u8');

    expect(lines[4]).toBe('#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720');
    expect(lines[5]).toBe('720p/playlist.m3u8');

    expect(lines[6]).toBe('#EXT-X-STREAM-INF:BANDWIDTH=1096000,RESOLUTION=854x480');
    expect(lines[7]).toBe('480p/playlist.m3u8');
  });

  it('computes BANDWIDTH as (maxrate + audio bitrate) in bits per second', () => {
    const oneRendition: Rendition[] = [
      { name: '480p', width: 854, height: 480, crf: 25, maxrateKbps: 1000, bufsizeKbps: 2000, audioBitrateKbps: 96 },
    ];

    const manifest = buildMasterManifest(oneRendition);

    expect(manifest).toContain('BANDWIDTH=1096000');
  });

  it('throws on an empty rendition list rather than emitting an empty-but-valid manifest', () => {
    expect(() => buildMasterManifest([])).toThrow();
  });
});
