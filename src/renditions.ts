/**
 * The 3-tier quality ladder for episode video HLS (ADR 0008). Tuned for
 * talking-head/screen-recording lesson content, not high-motion video — CRF
 * with a capped maxrate (not a flat bitrate) keeps simple scenes small while
 * still bounding worst-case bandwidth for HLS's bitrate-based ABR selection.
 */
export interface Rendition {
  name: '1080p' | '720p' | '480p';
  width: number;
  height: number;
  crf: number;
  maxrateKbps: number;
  bufsizeKbps: number;
  audioBitrateKbps: number;
}

export const RENDITIONS: Rendition[] = [
  { name: '1080p', width: 1920, height: 1080, crf: 21, maxrateKbps: 4500, bufsizeKbps: 9000, audioBitrateKbps: 128 },
  { name: '720p', width: 1280, height: 720, crf: 23, maxrateKbps: 2500, bufsizeKbps: 5000, audioBitrateKbps: 128 },
  { name: '480p', width: 854, height: 480, crf: 25, maxrateKbps: 1000, bufsizeKbps: 2000, audioBitrateKbps: 96 },
];

export const HLS_SEGMENT_SECONDS = 6;
