import { runTranscodeJob, TranscodeJobDeps } from '../job';
import { RENDITIONS } from '../renditions';

function makeDeps(overrides: Partial<TranscodeJobDeps> = {}): TranscodeJobDeps {
  return {
    downloadSource: jest.fn().mockResolvedValue('/tmp/source.mp4'),
    encodeAndUploadRendition: jest
      .fn()
      .mockImplementation(async (_sourcePath, rendition, keyPrefix) => `${keyPrefix}/${rendition.name}/playlist.m3u8`),
    uploadManifest: jest.fn().mockResolvedValue('episodes/42/hls/video/master.m3u8'),
    cleanupSource: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('runTranscodeJob', () => {
  it('downloads the source once, encodes every rendition, uploads the manifest, and cleans up', async () => {
    const deps = makeDeps();

    const result = await runTranscodeJob({ episodeId: 42, slot: 'video', sourceKey: 'episodes/42/video.mp4' }, deps);

    expect(deps.downloadSource).toHaveBeenCalledTimes(1);
    expect(deps.downloadSource).toHaveBeenCalledWith('episodes/42/video.mp4');

    expect(deps.encodeAndUploadRendition).toHaveBeenCalledTimes(RENDITIONS.length);
    for (const rendition of RENDITIONS) {
      expect(deps.encodeAndUploadRendition).toHaveBeenCalledWith('/tmp/source.mp4', rendition, 'episodes/42/hls/video');
    }

    expect(deps.uploadManifest).toHaveBeenCalledTimes(1);
    const [keyPrefix, manifestText] = (deps.uploadManifest as jest.Mock).mock.calls[0];
    expect(keyPrefix).toBe('episodes/42/hls/video');
    expect(manifestText).toContain('1080p/playlist.m3u8');
    expect(manifestText).toContain('720p/playlist.m3u8');
    expect(manifestText).toContain('480p/playlist.m3u8');

    expect(deps.cleanupSource).toHaveBeenCalledWith('/tmp/source.mp4');

    expect(result).toEqual({
      status: 'done',
      manifestKey: 'episodes/42/hls/video/master.m3u8',
      renditionKeys: {
        '1080p': 'episodes/42/hls/video/1080p/playlist.m3u8',
        '720p': 'episodes/42/hls/video/720p/playlist.m3u8',
        '480p': 'episodes/42/hls/video/480p/playlist.m3u8',
      },
    });
  });

  it('keeps a secondary-slot job under its own key prefix, independent of the main video', async () => {
    const deps = makeDeps();

    await runTranscodeJob({ episodeId: 42, slot: 'video_preview', sourceKey: 'episodes/42/observacao.mp4' }, deps);

    for (const rendition of RENDITIONS) {
      expect(deps.encodeAndUploadRendition).toHaveBeenCalledWith(
        '/tmp/source.mp4',
        rendition,
        'episodes/42/hls/video_preview',
      );
    }
  });

  it('fails the whole job if any single rendition fails, without uploading a manifest', async () => {
    const deps = makeDeps({
      encodeAndUploadRendition: jest
        .fn()
        .mockResolvedValueOnce('episodes/42/hls/video/1080p/playlist.m3u8')
        .mockRejectedValueOnce(new Error('ffmpeg exited with code 1')),
    });

    const result = await runTranscodeJob({ episodeId: 42, slot: 'video', sourceKey: 'episodes/42/video.mp4' }, deps);

    expect(deps.uploadManifest).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'failed', error: 'ffmpeg exited with code 1' });
  });

  it('still cleans up the downloaded source when a rendition fails', async () => {
    const deps = makeDeps({
      encodeAndUploadRendition: jest.fn().mockRejectedValue(new Error('boom')),
    });

    await runTranscodeJob({ episodeId: 42, slot: 'video', sourceKey: 'episodes/42/video.mp4' }, deps);

    expect(deps.cleanupSource).toHaveBeenCalledWith('/tmp/source.mp4');
  });

  it('fails the job if downloading the source itself fails', async () => {
    const deps = makeDeps({
      downloadSource: jest.fn().mockRejectedValue(new Error('R2 object not found')),
    });

    const result = await runTranscodeJob({ episodeId: 42, slot: 'video', sourceKey: 'episodes/42/video.mp4' }, deps);

    expect(deps.encodeAndUploadRendition).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'failed', error: 'R2 object not found' });
  });
});
