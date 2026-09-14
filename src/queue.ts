/**
 * Strictly serial FIFO queue: at most one item is ever being processed at a
 * time, regardless of how many are enqueued back-to-back. Exists because
 * ffmpeg encodes are CPU/disk heavy and this service otherwise has no
 * concurrency limit — a batch trigger (ticket 04 of
 * .scratch/hls-multi-bitrate-pipeline) could otherwise stack up many ffmpeg
 * processes on one container at once. In-memory only: a restart drops
 * whatever was queued (acceptable here — the caller, e.g. the batch script,
 * is expected to re-trigger anything that didn't get a callback).
 */
export class JobQueue<T> {
  private readonly pending: T[] = [];
  private processing = false;

  constructor(private readonly process: (item: T) => Promise<void>) {}

  enqueue(item: T): void {
    this.pending.push(item);
    this.drain();
  }

  /** Items waiting plus the one currently in flight, if any. */
  get length(): number {
    return this.pending.length + (this.processing ? 1 : 0);
  }

  private drain(): void {
    if (this.processing) {
      return;
    }

    const next = this.pending.shift();
    if (next === undefined) {
      return;
    }

    this.processing = true;
    this.process(next)
      .catch(() => {
        // The processor (job.ts's runTranscodeJob + callback) is expected to
        // catch its own errors and report them via callback — this guards
        // the queue itself from stalling if something still throws.
      })
      .finally(() => {
        this.processing = false;
        this.drain();
      });
  }
}
