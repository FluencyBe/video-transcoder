import { spawn } from 'child_process';
import { Rendition } from './renditions';

/**
 * ffmpeg args for one rendition: scale down (never up — `min(height, ih)`)
 * preserving aspect ratio, CRF-encode with a capped maxrate/bufsize so a
 * complex scene can't blow past the rendition's advertised HLS bandwidth,
 * and segment straight to an HLS VOD playlist under outDir.
 */
export function buildFfmpegArgs(sourcePath: string, rendition: Rendition, outDir: string, segmentSeconds: number): string[] {
  return [
    '-y',
    '-i',
    sourcePath,
    '-vf',
    `scale=-2:'min(${rendition.height},ih)'`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    String(rendition.crf),
    '-maxrate',
    `${rendition.maxrateKbps}k`,
    '-bufsize',
    `${rendition.bufsizeKbps}k`,
    '-c:a',
    'aac',
    '-b:a',
    `${rendition.audioBitrateKbps}k`,
    '-hls_time',
    String(segmentSeconds),
    '-hls_playlist_type',
    'vod',
    '-hls_segment_filename',
    `${outDir}/segment_%03d.ts`,
    `${outDir}/playlist.m3u8`,
  ];
}

/**
 * Runs one ffmpeg encode to completion. Not unit tested (would require a
 * real ffmpeg binary + media file) — buildFfmpegArgs above carries the
 * tested logic; this is a thin process wrapper around it.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}
