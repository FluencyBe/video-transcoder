# video-transcoder

HLS multi-bitrate transcoding service for Fluency-be episode video — see
[ADR 0008](../docs/adr/0008-hls-multi-bitrate-pipeline-for-video-buffering.md).

Given one episode's already-migrated R2 source video, produces 3 HLS quality
renditions (1080p/720p/480p) plus a master manifest, uploads them to R2, and
reports the result back to `portalfluencybe` via a callback POST.

## API

`POST /jobs` `{ episodeId, sourceKey }` → `202 Accepted` immediately; the
actual encode runs in the background (can take minutes) and reports its
result via `POST {TRANSCODE_CALLBACK_URL}/episodes/{episodeId}/transcode-callback`.

`GET /health` → `{ ok: true }`.

## Local development

```
npm install
cp .env.example .env   # fill in real values
npm run dev
npm test
```

Running an actual job locally requires the `ffmpeg` binary on PATH (not
installed via npm — see the Dockerfile for the apt package used in
production).

## Deploying (human steps — not doable from code)

This service has no existing infra-as-code precedent in this monorepo
(EasyPanel is configured entirely through its dashboard here). To deploy:

1. In EasyPanel, create a new service from this directory's `Dockerfile`.
2. Set the env vars from `.env.example` (real R2 credentials, the real
   `TRANSCODE_CALLBACK_URL` pointing at the deployed portalfluencybe, and a
   freshly generated `TRANSCODE_CALLBACK_TOKEN`).
3. Set the same `TRANSCODER_CALLBACK_TOKEN` value in portalfluencybe's env
   (see `portalfluencybe/.env.example`).
4. Note the service's internal/external URL — portalfluencybe's
   `VIDEO_TRANSCODER_URL` env var needs to point at it.
5. Ensure the container has enough CPU/memory for 3 parallel-ish ffmpeg
   encodes without starving other EasyPanel services — size this from a
   real encode's resource usage, not guessed.
