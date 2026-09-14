import { Rendition } from './renditions';

export interface TranscodeJobInput {
  episodeId: string | number;
  /** 'video' for the main video, or one of portalfluencybe's secondary video slots ('video_preview' | 'google_calendar' | 'outlook_calendar'). Keeps R2 keys and the callback from colliding across an episode's multiple videos. */
  slot: string;
  sourceKey: string;
}

export type RenditionKeys = Partial<Record<Rendition['name'], string>>;

export type TranscodeJobResult =
  | { status: 'done'; manifestKey: string; renditionKeys: Record<Rendition['name'], string> }
  | { status: 'failed'; error: string };
