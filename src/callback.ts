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
      Authorization: `Bearer ${callbackToken}`,
    },
    body: JSON.stringify({ slot: input.slot, ...result }),
  });

  if (!response.ok) {
    throw new Error(`Callback POST failed with status ${response.status}`);
  }
}
