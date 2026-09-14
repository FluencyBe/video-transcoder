import { buildMasterManifest } from './manifest';
import { Rendition, RENDITIONS } from './renditions';
import { TranscodeJobInput, TranscodeJobResult } from './types';

export interface TranscodeJobDeps {
  downloadSource(sourceKey: string): Promise<string>;
  /** Encodes one rendition and uploads its variant playlist + segments under `{keyPrefix}/{rendition.name}/`, returning the variant playlist's R2 key. */
  encodeAndUploadRendition(sourcePath: string, rendition: Rendition, keyPrefix: string): Promise<string>;
  uploadManifest(keyPrefix: string, manifestText: string): Promise<string>;
  cleanupSource(sourcePath: string): Promise<void>;
}

/**
 * Orchestrates one episode's HLS transcode: download once, encode+upload
 * every rendition, then the master manifest. Any single rendition failing
 * fails the whole job — a partial rendition ladder is not something the
 * player/manifest-proxy is designed to serve (ADR 0008 has no "degrade to
 * fewer qualities" mode). The source download is always cleaned up.
 */
export async function runTranscodeJob(input: TranscodeJobInput, deps: TranscodeJobDeps): Promise<TranscodeJobResult> {
  const keyPrefix = `episodes/${input.episodeId}/hls/${input.slot}`;

  let sourcePath: string;
  try {
    sourcePath = await deps.downloadSource(input.sourceKey);
  } catch (error) {
    return { status: 'failed', error: (error as Error).message };
  }

  try {
    const renditionKeys: Partial<Record<Rendition['name'], string>> = {};

    for (const rendition of RENDITIONS) {
      renditionKeys[rendition.name] = await deps.encodeAndUploadRendition(sourcePath, rendition, keyPrefix);
    }

    const manifestText = buildMasterManifest(RENDITIONS);
    const manifestKey = await deps.uploadManifest(keyPrefix, manifestText);

    return {
      status: 'done',
      manifestKey,
      renditionKeys: renditionKeys as Record<Rendition['name'], string>,
    };
  } catch (error) {
    return { status: 'failed', error: (error as Error).message };
  } finally {
    await deps.cleanupSource(sourcePath);
  }
}
