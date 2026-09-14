import Fastify from 'fastify';
import { loadConfig } from './config';
import { R2Client } from './r2';
import { buildPipelineDeps } from './pipeline';
import { runTranscodeJob } from './job';
import { postCallback } from './callback';
import { JobQueue } from './queue';
import { TranscodeJobInput } from './types';

const config = loadConfig();
const r2 = new R2Client(config.r2);
const deps = buildPipelineDeps(r2);

const app = Fastify({ logger: true });

// ffmpeg is CPU/disk heavy and this service has no other concurrency limit —
// a batch trigger (ticket 04 of .scratch/hls-multi-bitrate-pipeline) firing
// many /jobs requests back-to-back must not stack up several ffmpeg
// processes on one container at once. See queue.ts.
const jobQueue = new JobQueue<TranscodeJobInput>(runJobInBackground);

app.get('/health', async () => ({ ok: true, queueLength: jobQueue.length }));

app.post<{ Body: TranscodeJobInput }>('/jobs', async (request, reply) => {
  const { episodeId, slot, sourceKey } = request.body ?? ({} as TranscodeJobInput);

  if (!episodeId || !slot || !sourceKey) {
    return reply.code(400).send({ error: 'episodeId, slot and sourceKey are required' });
  }

  // Accepted immediately; the actual encode is processed one-at-a-time by
  // jobQueue and its result is reported later via the callback (this can
  // take minutes for a real video).
  jobQueue.enqueue({ episodeId, slot, sourceKey });

  reply.code(202).send({ accepted: true, queuePosition: jobQueue.length });
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
