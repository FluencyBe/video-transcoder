import { JobQueue } from '../queue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('JobQueue', () => {
  it('processes one item at a time — the second item is not started until the first resolves', async () => {
    const started: string[] = [];
    const first = deferred<void>();
    const second = deferred<void>();

    const process = jest.fn().mockImplementation(async (item: string) => {
      started.push(item);
      return item === 'a' ? first.promise : second.promise;
    });

    const queue = new JobQueue<string>(process);

    queue.enqueue('a');
    queue.enqueue('b');

    // Both enqueued synchronously, but only 'a' should have started.
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual(['a']);

    first.resolve();
    // Let the microtask queue drain so 'b' gets picked up.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual(['a', 'b']);

    second.resolve();
  });

  it('continues to the next item even if a job rejects', async () => {
    const started: string[] = [];
    const process = jest.fn().mockImplementation(async (item: string) => {
      started.push(item);
      if (item === 'a') {
        throw new Error('boom');
      }
    });

    const queue = new JobQueue<string>(process);
    queue.enqueue('a');
    queue.enqueue('b');

    // Flush microtasks until both have run.
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }

    expect(started).toEqual(['a', 'b']);
  });

  it('reports pending + in-flight count via length', async () => {
    const gate = deferred<void>();
    const process = jest.fn().mockImplementation(async () => gate.promise);

    const queue = new JobQueue<string>(process);
    expect(queue.length).toBe(0);

    queue.enqueue('a');
    await Promise.resolve();
    expect(queue.length).toBe(1); // 'a' in flight, nothing queued behind it

    queue.enqueue('b');
    queue.enqueue('c');
    expect(queue.length).toBe(3); // 'a' in flight + 'b','c' waiting

    gate.resolve();
  });
});
