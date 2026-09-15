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

// Progress tracking for the batch log lines. Jobs are processed strictly
// one-at-a-time, so "remaining" is enqueued minus completed. Reset whenever
// the queue drains, so each new batch gets a fresh ETA instead of averaging
// over the idle gap since the last one.
let totalEnqueued = 0;
let totalCompleted = 0;
let batchStartedAt: number | null = null;

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds < 3600) {
    return `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
  }
  return `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m`;
}

function etaSuffix(): string {
  if (batchStartedAt === null || totalCompleted <= 0 || totalCompleted >= totalEnqueued) {
    return '';
  }

  const elapsedSeconds = (Date.now() - batchStartedAt) / 1000;
  const secondsPerJob = elapsedSeconds / totalCompleted;
  const remaining = totalEnqueued - totalCompleted;

  return ` · ETA ~${formatDuration(Math.round(secondsPerJob * remaining))}`;
}

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
  totalEnqueued += 1;
  if (batchStartedAt === null) {
    batchStartedAt = Date.now();
  }

  reply.code(202).send({ accepted: true, queuePosition: jobQueue.length });
});

async function runJobInBackground(input: TranscodeJobInput): Promise<void> {
  app.log.info(`[Transcode] iniciando: episódio ${input.episodeId}, slot ${input.slot} (${totalCompleted + 1}/${totalEnqueued})`);

  let status = 'done';
  try {
    const result = await runTranscodeJob(input, deps);
    status = result.status;
    await postCallback(config.callbackUrl, config.callbackToken, input, result);
  } catch (error) {
    status = 'failed';
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

  totalCompleted += 1;
  const remaining = totalEnqueued - totalCompleted;
  app.log.info(
    `[Transcode] concluído: episódio ${input.episodeId}, slot ${input.slot} — ${status} · ${totalCompleted}/${totalEnqueued} concluído(s), ${remaining} restante(s)${etaSuffix()}`,
  );

  if (remaining === 0) {
    app.log.info(`[Transcode] finalizado com sucesso: ${totalCompleted} job(s) concluído(s)`);
    totalEnqueued = 0;
    totalCompleted = 0;
    batchStartedAt = null;
  }
}

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
