import { Rendition } from './renditions';

export interface TranscodeJobInput {
  episodeId: string | number;
  sourceKey: string;
}

export type RenditionKeys = Partial<Record<Rendition['name'], string>>;

export type TranscodeJobResult =
  | { status: 'done'; manifestKey: string; renditionKeys: Record<Rendition['name'], string> }
  | { status: 'failed'; error: string };
