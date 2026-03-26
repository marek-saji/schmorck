import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApiShield } from './apiShield.ts';

/** Yield to the event loop so resolved promises propagate. Uses setImmediate to avoid being captured by mock timers. */
function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

const ok = async () => new Response();

describe('apiShield', () => {
  // Silence console output from apiShield internals
  const noop = () => {};
  mock.method(console, 'warn', noop);
  mock.method(console, 'error', noop);

  describe('createApiShield', () => {
    it('throws on invalid rateLimitReqPerMin', () => {
      assert.throws(() => createApiShield({ rateLimitReqPerMin: 0 }), RangeError);
      assert.throws(() => createApiShield({ rateLimitReqPerMin: -1 }), RangeError);
      assert.throws(() => createApiShield({ rateLimitReqPerMin: NaN }), RangeError);
    });

    it('accepts Infinity', () => {
      assert.doesNotThrow(() => createApiShield({ rateLimitReqPerMin: Infinity }));
    });
  });

  describe('queue', () => {
    it('returns the task result', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const response = new Response('test');
      const result = await shield.queue(() => Promise.resolve(response));
      assert.equal(result, response);
    });

    it('executes tasks in FIFO order', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<number> = [];
      await Promise.all([
        shield.queue(() => { order.push(1); return ok(); }),
        shield.queue(() => { order.push(2); return ok(); }),
        shield.queue(() => { order.push(3); return ok(); }),
      ]);
      assert.deepEqual(order, [1, 2, 3]);
    });

    it('runs only one task at a time', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let concurrent = 0;
      let maxConcurrent = 0;

      const task = async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await flush();
        concurrent--;
        return new Response();
      };

      await Promise.all([
        shield.queue(task),
        shield.queue(task),
        shield.queue(task),
      ]);
      assert.equal(maxConcurrent, 1);
    });
  });

  describe('rate limiting', () => {
    it('enforces minimum interval between requests', async (t) => {
      // Start at non-zero time so first task doesn't wait (lastRequestAt=0, elapsed is large)
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: 60 }); // 1 per second
      const timestamps: Array<number> = [];

      const p1 = shield.queue(() => { timestamps.push(Date.now()); return ok(); });
      const p2 = shield.queue(() => { timestamps.push(Date.now()); return ok(); });
      const p3 = shield.queue(() => { timestamps.push(Date.now()); return ok(); });

      // First task runs immediately (elapsed since epoch >> 1000ms)
      await flush();
      assert.equal(timestamps.length, 1);

      // Second task needs 1000ms wait
      t.mock.timers.tick(1_000);
      await flush();
      assert.equal(timestamps.length, 2);

      // Third task needs another 1000ms
      t.mock.timers.tick(1_000);
      await flush();

      await Promise.all([p1, p2, p3]);
      assert.equal(timestamps.length, 3);

      assert.equal(timestamps[1] - timestamps[0], 1_000);
      assert.equal(timestamps[2] - timestamps[1], 1_000);
    });

    it('skips delay with Infinity rate', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const start = Date.now();
      await shield.queue(() => ok());
      await shield.queue(() => ok());
      await shield.queue(() => ok());
      const elapsed = Date.now() - start;
      assert.ok(elapsed < 50, `Expected < 50ms, got ${elapsed}ms`);
    });
  });

  describe('error isolation', () => {
    it('rejects only the failing task', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const results: Array<string> = [];

      const p1 = shield.queue(() => { results.push('first'); return ok(); });
      const p2 = shield.queue(() => { throw new Error('boom'); });
      const p3 = shield.queue(() => { results.push('third'); return ok(); });

      await p1;
      await assert.rejects(p2, { message: 'boom' });
      await p3;

      assert.deepEqual(results, ['first', 'third']);
    });
  });

  describe('pause / resume', () => {
    it('pauses and resumes the queue', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      shield.pause();

      const p1 = shield.queue(() => { order.push('a'); return ok(); });
      const p2 = shield.queue(() => { order.push('b'); return ok(); });

      t.mock.timers.tick(100);
      await flush();
      assert.deepEqual(order, [], 'nothing runs while paused');

      shield.resume();
      t.mock.timers.tick(0);
      await flush();
      await Promise.all([p1, p2]);

      assert.deepEqual(order, ['a', 'b']);
    });

    it('is idempotent', () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      shield.pause();
      shield.pause(); // no-op
      shield.resume();
      shield.resume(); // no-op
    });
  });

  describe('backOff', () => {
    it('inserts delay before pending tasks', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      shield.pause();
      const p1 = shield.queue(() => { order.push('task'); return ok(); });
      shield.backOff(2_000);
      shield.resume();

      // After 0ms: backOff delay starts (it was unshifted to front)
      t.mock.timers.tick(0);
      await flush();
      assert.deepEqual(order, []);

      // After 2000ms: backOff delay completes, task runs
      t.mock.timers.tick(2_000);
      await flush();
      await p1;
      assert.deepEqual(order, ['task']);
    });
  });

  describe('AbortSignal', () => {
    it('rejects immediately if signal is already aborted', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const controller = new AbortController();
      controller.abort('cancelled');

      await assert.rejects(
        shield.queue(() => ok(), { signal: controller.signal }),
        (err) => err === 'cancelled',
      );
    });

    it('removes task from queue when aborted', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      shield.pause();
      const p1 = shield.queue(() => { order.push('first'); return ok(); });

      const controller = new AbortController();
      const p2 = shield.queue(() => { order.push('second'); return ok(); }, { signal: controller.signal });

      const p3 = shield.queue(() => { order.push('third'); return ok(); });

      // Abort the second task while it's still queued
      controller.abort(new DOMException('Aborted', 'AbortError'));

      assert.equal(shield.queueLength, 2, 'aborted task removed from queue');

      // Handle the rejection so it doesn't leak
      p2.catch(() => {});

      shield.resume();
      t.mock.timers.tick(0);
      await flush();

      await p1;
      await assert.rejects(p2, { name: 'AbortError' });
      await p3;

      assert.deepEqual(order, ['first', 'third']);
    });
  });

  describe('429 auto-retry', () => {
    it('retries on 429 with Retry-After and returns the successful response', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const warnMock = console.warn as ReturnType<typeof mock.fn>;
      const warnsBefore = warnMock.mock.callCount();

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;

      const task = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', { status: 429, headers: { 'Retry-After': '5' } });
        }
        return new Response('success', { status: 200 });
      };

      const p = shield.queue(task);

      // First call happens immediately
      await flush();
      assert.equal(callCount, 1);
      assert.equal(warnMock.mock.callCount() - warnsBefore, 1);
      assert.match(String(warnMock.mock.calls[warnsBefore].arguments[0]), /429.*5000/);

      // Wait for Retry-After (5s)
      t.mock.timers.tick(5_000);
      await flush();

      const result = await p;
      assert.equal(callCount, 2);
      assert.equal(result.status, 200);
    });

    it('retries multiple 429s until success', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;

      const task = async () => {
        callCount++;
        if (callCount <= 2) {
          return new Response('', { status: 429, headers: { 'Retry-After': '1' } });
        }
        return new Response('ok', { status: 200 });
      };

      const p = shield.queue(task);

      await flush();
      assert.equal(callCount, 1);

      t.mock.timers.tick(1_000);
      await flush();
      assert.equal(callCount, 2);

      t.mock.timers.tick(1_000);
      await flush();

      const result = await p;
      assert.equal(callCount, 3);
      assert.equal(result.status, 200);
    });

    it('uses X-Ratelimit.until when no Retry-After', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;
      const untilDate = new Date(100_000 + 3_000).toISOString();

      const task = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', {
            status: 429,
            headers: { 'X-Ratelimit': JSON.stringify({ remaining: 0, until: untilDate }) },
          });
        }
        return new Response('ok', { status: 200 });
      };

      const p = shield.queue(task);
      await flush();
      assert.equal(callCount, 1);

      t.mock.timers.tick(3_000);
      await flush();

      const result = await p;
      assert.equal(callCount, 2);
      assert.equal(result.status, 200);
    });

    it('falls back to fallbackRetryMs when no headers', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity, fallbackRetryMs: 10_000 });
      let callCount = 0;

      const task = async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', { status: 429 });
        }
        return new Response('ok', { status: 200 });
      };

      const p = shield.queue(task);
      await flush();
      assert.equal(callCount, 1);

      // Not enough time
      t.mock.timers.tick(5_000);
      await flush();
      assert.equal(callCount, 1);

      // Now enough
      t.mock.timers.tick(5_000);
      await flush();

      const result = await p;
      assert.equal(callCount, 2);
      assert.equal(result.status, 200);
    });
  });

  describe('preemptive backoff', () => {
    it('backs off when remaining is 0', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const untilDate = new Date(100_000 + 5_000).toISOString();
      const timestamps: Array<number> = [];

      const p1 = shield.queue(async () => {
        timestamps.push(Date.now());
        return new Response('ok', {
          status: 200,
          headers: { 'X-Ratelimit': JSON.stringify({ remaining: 0, until: untilDate }) },
        });
      });

      const p2 = shield.queue(async () => {
        timestamps.push(Date.now());
        return new Response('ok', { status: 200 });
      });

      // First task runs immediately
      await flush();
      assert.equal(timestamps.length, 1);

      // Second task should be delayed by backOff (5s)
      t.mock.timers.tick(5_000);
      await flush();

      await Promise.all([p1, p2]);
      assert.equal(timestamps.length, 2);
      assert.ok(timestamps[1] - timestamps[0] >= 5_000);
    });

    it('does not back off when remaining > 0', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });

      const p1 = shield.queue(async () => {
        return new Response('ok', {
          status: 200,
          headers: { 'X-Ratelimit': JSON.stringify({ remaining: 50, until: new Date(Date.now() + 60_000).toISOString() }) },
        });
      });

      const p2 = shield.queue(() => ok());

      await p1;
      await p2;
      assert.equal(shield.queueLength, 0);
    });
  });

  describe('malformed X-Ratelimit', () => {
    it('logs error and backs off on malformed JSON', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const errorMock = console.error as ReturnType<typeof mock.fn>;
      const callsBefore = errorMock.mock.callCount();

      const shield = createApiShield({ rateLimitReqPerMin: Infinity, malformedHeaderBackoffMs: 2_000 });
      const timestamps: Array<number> = [];

      const p1 = shield.queue(async () => {
        timestamps.push(Date.now());
        return new Response('ok', {
          status: 200,
          headers: { 'X-Ratelimit': 'not json' },
        });
      });

      const p2 = shield.queue(async () => {
        timestamps.push(Date.now());
        return new Response('ok', { status: 200 });
      });

      await flush();
      assert.equal(timestamps.length, 1);
      assert.equal(errorMock.mock.callCount() - callsBefore, 1);
      const errorArg = errorMock.mock.calls[callsBefore].arguments[0];
      assert.ok(errorArg instanceof Error);
      assert.match(errorArg.message, /malformed X-Ratelimit/);

      // Second task delayed by malformedHeaderBackoffMs (2s)
      t.mock.timers.tick(2_000);
      await flush();

      await Promise.all([p1, p2]);
      assert.equal(timestamps.length, 2);
    });
  });

  describe('fetch', () => {
    it('delegates to queue and global fetch', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });

      const mockResponse = new Response('ok', { status: 200 });
      const originalFetch = globalThis.fetch;
      const fetchMock = mock.fn(() => Promise.resolve(mockResponse));
      globalThis.fetch = fetchMock;

      try {
        const response = await shield.fetch('https://example.com/api', {
          method: 'POST',
          headers: { 'X-Test': '1' },
        });
        assert.equal(response, mockResponse);
        assert.equal(fetchMock.mock.callCount(), 1);
        const args = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
        assert.equal(args[0], 'https://example.com/api');
        assert.equal(args[1].method, 'POST');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('queueLength', () => {
    it('reflects the number of pending tasks', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      assert.equal(shield.queueLength, 0);

      shield.pause();
      const p1 = shield.queue(() => ok());
      const p2 = shield.queue(() => ok());
      assert.equal(shield.queueLength, 2);

      shield.resume();
      t.mock.timers.tick(0);
      await flush();
      await Promise.all([p1, p2]);
      assert.equal(shield.queueLength, 0);
    });
  });
});
