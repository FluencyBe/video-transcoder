import { TranscodeJobInput, TranscodeJobResult } from './types';

/**
 * Reports a finished (or failed) job back to portalfluencybe, which owns the
 * episodes table. Authenticated with a shared bearer token (TRANSCODE_CALLBACK_TOKEN)
 * — this is a trusted server-to-server call, not a user-facing endpoint.
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
    body: JSON.stringify(result),
  });

  if (!response.ok) {
    throw new Error(`Callback POST failed with status ${response.status}`);
  }
}
