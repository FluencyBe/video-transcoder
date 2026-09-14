import { TranscodeJobInput, TranscodeJobResult } from './types';

/**
 * Reports a finished (or failed) job back to portalfluencybe, which owns the
 * episode_video_transcodes table. Authenticated with a shared bearer token
 * (TRANSCODE_CALLBACK_TOKEN) — this is a trusted server-to-server call, not
 * a user-facing endpoint. `slot` rides along in the body so the callback
 * knows which of the episode's (possibly several) videos this result is
 * for.
 */
export async function postCallback(
  callbackUrl: string,
  callbackToken: string,
  input: TranscodeJobInput,
  result: TranscodeJobResult,
): Promise<void> {
  const response = await fetch(`${callbackUrl}/episodes/${input.episodeId}/transcode-callback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Asks Laravel for a JSON error body instead of an HTML Whoops page on
      // failure — much more useful in this service's own (JSON) logs.
      Accept: 'application/json',
      Authorization: `Bearer ${callbackToken}`,
    },
    // Echo the sourceKey back so the callback can record which R2 object this
    // transcode was actually built from (ADR 0009 source_key staleness check) —
    // `result` alone carries no trace of the source.
    body: JSON.stringify({ slot: input.slot, sourceKey: input.sourceKey, ...result }),
  });

  if (!response.ok) {
    // Read the body so the actual Laravel error (with APP_DEBUG=true, a full
    // exception message) lands in this service's own logs, instead of being
    // silently discarded — otherwise diagnosing a callback failure means
    // separately digging through portalfluencybe's logs.
    const body = await response.text().catch(() => '<failed to read response body>');
    throw new Error(`Callback POST failed with status ${response.status}: ${body.slice(0, 2000)}`);
  }
}
