import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { TranscodeJobDeps } from './job';
import { buildFfmpegArgs, runFfmpeg } from './ffmpeg';
import { HLS_SEGMENT_SECONDS } from './renditions';
import { R2Client } from './r2';

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
};

/**
 * Real (I/O-touching) implementation of TranscodeJobDeps, wiring ffmpeg + R2
 * together. Kept separate from job.ts's orchestration logic so that logic
 * stays unit-testable without a real ffmpeg binary or R2 credentials.
 */
export function buildPipelineDeps(r2: R2Client): TranscodeJobDeps {
  return {
    async downloadSource(sourceKey) {
      const dir = await mkdtemp(join(tmpdir(), 'transcode-src-'));
      const destPath = join(dir, `source${extname(sourceKey) || '.mp4'}`);
      await r2.downloadToFile(sourceKey, destPath);
      return destPath;
    },

    async encodeAndUploadRendition(sourcePath, rendition, keyPrefix) {
      const outDir = await mkdtemp(join(tmpdir(), `transcode-${rendition.name}-`));
      try {
        const args = buildFfmpegArgs(sourcePath, rendition, outDir, HLS_SEGMENT_SECONDS);
        await runFfmpeg(args);

        const files = await readdir(outDir);
        for (const file of files) {
          const contentType = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
          await r2.uploadFile(`${keyPrefix}/${rendition.name}/${file}`, join(outDir, file), contentType);
        }

        return `${keyPrefix}/${rendition.name}/playlist.m3u8`;
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },

    async uploadManifest(keyPrefix, manifestText) {
      const key = `${keyPrefix}/master.m3u8`;
      await r2.uploadText(key, manifestText, CONTENT_TYPES['.m3u8']);
      return key;
    },

    async cleanupSource(sourcePath) {
      await rm(sourcePath, { force: true });
    },
  };
}
