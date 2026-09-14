import { buildFfmpegArgs } from '../ffmpeg';
import { Rendition } from '../renditions';

const rendition: Rendition = {
  name: '720p',
  width: 1280,
  height: 720,
  crf: 23,
  maxrateKbps: 2500,
  bufsizeKbps: 5000,
  audioBitrateKbps: 128,
};

describe('buildFfmpegArgs', () => {
  it('scales to the rendition resolution while preserving aspect ratio', () => {
    const args = buildFfmpegArgs('/tmp/source.mp4', rendition, '/tmp/out', 6);

    expect(args).toContain('-vf');
    expect(args[args.indexOf('-vf') + 1]).toBe("scale=-2:'min(720,ih)'");
  });

  it('sets CRF, maxrate and bufsize from the rendition', () => {
    const args = buildFfmpegArgs('/tmp/source.mp4', rendition, '/tmp/out', 6);

    expect(args).toEqual(
      expect.arrayContaining(['-crf', '23', '-maxrate', '2500k', '-bufsize', '5000k', '-b:a', '128k']),
    );
  });

  it('sets the HLS segment duration and VOD playlist type', () => {
    const args = buildFfmpegArgs('/tmp/source.mp4', rendition, '/tmp/out', 6);

    expect(args).toEqual(expect.arrayContaining(['-hls_time', '6', '-hls_playlist_type', 'vod']));
  });

  it('writes the variant playlist and segments under the given output directory', () => {
    const args = buildFfmpegArgs('/tmp/source.mp4', rendition, '/tmp/out', 6);

    expect(args).toEqual(expect.arrayContaining(['-hls_segment_filename', '/tmp/out/segment_%03d.ts']));
    expect(args[args.length - 1]).toBe('/tmp/out/playlist.m3u8');
  });

  it('overwrites without prompting and reads from the given source path', () => {
    const args = buildFfmpegArgs('/tmp/source.mp4', rendition, '/tmp/out', 6);

    expect(args[0]).toBe('-y');
    expect(args).toEqual(expect.arrayContaining(['-i', '/tmp/source.mp4']));
  });
});
