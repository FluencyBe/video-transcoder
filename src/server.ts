import Fastify from 'fastify';
import { loadConfig } from './config';
import { R2Client } from './r2';
import { buildPipelineDeps } from './pipeline';
import { runTranscodeJob } from './job';
import { postCallback } from './callback';
import { TranscodeJobInput } from './types';

const config = loadConfig();
const r2 = new R2Client(config.r2);
const deps = buildPipelineDeps(r2);

const app = Fastify({ logger: true });

app.get('/health', async () => ({ ok: true }));

app.post<{ Body: TranscodeJobInput }>('/jobs', async (request, reply) => {
  const { episodeId, sourceKey } = request.body ?? ({} as TranscodeJobInput);

  if (!episodeId || !sourceKey) {
    return reply.code(400).send({ error: 'episodeId and sourceKey are required' });
  }

  // Fire-and-forget: the caller gets 202 immediately, the actual result is
  // reported later via the callback (this can take minutes for a real video).
  reply.code(202).send({ accepted: true });

  runJobInBackground({ episodeId, sourceKey });
});

async function runJobInBackground(input: TranscodeJobInput): Promise<void> {
  try {
    const result = await runTranscodeJob(input, deps);
    await postCallback(config.callbackUrl, config.callbackToken, input, result);
  } catch (error) {
    app.log.error({ err: error, episodeId: input.episodeId }, 'transcode job crashed outside runTranscodeJob');
    try {
      await postCallback(config.callbackUrl, config.callbackToken, input, {
        status: 'failed',
        error: (error as Error).message,
      });
    } catch (callbackError) {
      app.log.error({ err: callbackError, episodeId: input.episodeId }, 'failed to report job failure via callback');
    }
  }
}

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
