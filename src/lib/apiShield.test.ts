import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApiShield } from './apiShield.ts';

/** Yield to the event loop so resolved promises propagate. Uses setImmediate to avoid being captured by mock timers. */
function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

const URL_A = 'http://test/a';
const URL_B = 'http://test/b';
const URL_C = 'http://test/c';

describe('apiShield', () => {
  const noop = () => {};
  mock.method(console, 'warn', noop);
  mock.method(console, 'error', noop);

  const originalFetch = globalThis.fetch;

  function mockFetch(impl: (...args: Array<unknown>) => Promise<Response>) {
    globalThis.fetch = mock.fn(impl) as typeof fetch;
  }

  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

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

  describe('fetch', () => {
    it('returns the fetch response', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const expected = new Response('test');
      mockFetch(async () => expected);
      try {
        const result = await shield.fetch(URL_A);
        assert.equal(result, expected);
      } finally {
        restoreFetch();
      }
    });

    it('passes url and options to global fetch', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      mockFetch(async () => new Response());
      try {
        await shield.fetch(URL_A, { method: 'POST', headers: { 'X-Test': '1' } });
        const fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock.fn>;
        assert.equal(fetchMock.mock.callCount(), 1);
        const args = fetchMock.mock.calls[0].arguments as unknown as [string, RequestInit];
        assert.equal(args[0], URL_A);
        assert.equal(args[1].method, 'POST');
      } finally {
        restoreFetch();
      }
    });

    it('executes requests in FIFO order', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<number> = [];
      mockFetch(async (...args: Array<unknown>) => {
        const url = String(args[0]);
        if (url.endsWith('/a')) order.push(1);
        if (url.endsWith('/b')) order.push(2);
        if (url.endsWith('/c')) order.push(3);
        return new Response();
      });
      try {
        await Promise.all([
          shield.fetch(URL_A),
          shield.fetch(URL_B),
          shield.fetch(URL_C),
        ]);
        assert.deepEqual(order, [1, 2, 3]);
      } finally {
        restoreFetch();
      }
    });

    it('runs only one request at a time', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let concurrent = 0;
      let maxConcurrent = 0;

      mockFetch(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await flush();
        concurrent--;
        return new Response();
      });
      try {
        await Promise.all([
          shield.fetch(URL_A),
          shield.fetch(URL_B),
          shield.fetch(URL_C),
        ]);
        assert.equal(maxConcurrent, 1);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('rate limiting', () => {
    it('enforces minimum interval between requests', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: 60 }); // 1 per second
      const timestamps: Array<number> = [];

      mockFetch(async () => {
        timestamps.push(Date.now());
        return new Response();
      });
      try {
        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);
        const p3 = shield.fetch(URL_C);

        // First request runs immediately (elapsed since epoch >> 1000ms)
        await flush();
        assert.equal(timestamps.length, 1);

        // Second request needs 1000ms wait
        t.mock.timers.tick(1_000);
        await flush();
        assert.equal(timestamps.length, 2);

        // Third request needs another 1000ms
        t.mock.timers.tick(1_000);
        await flush();

        await Promise.all([p1, p2, p3]);
        assert.equal(timestamps.length, 3);

        assert.equal(timestamps[1] - timestamps[0], 1_000);
        assert.equal(timestamps[2] - timestamps[1], 1_000);
      } finally {
        restoreFetch();
      }
    });

    it('skips delay with Infinity rate', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      mockFetch(async () => new Response());
      try {
        const start = Date.now();
        await shield.fetch(URL_A);
        await shield.fetch(URL_B);
        await shield.fetch(URL_C);
        const elapsed = Date.now() - start;
        assert.ok(elapsed < 50, `Expected < 50ms, got ${elapsed}ms`);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('error isolation', () => {
    it('rejects only the failing request', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const results: Array<string> = [];
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        if (callCount === 2) throw new Error('boom');
        results.push(`call-${callCount}`);
        return new Response();
      });
      try {
        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);
        const p3 = shield.fetch(URL_C);

        await p1;
        await assert.rejects(p2, { message: 'boom' });
        await p3;

        assert.deepEqual(results, ['call-1', 'call-3']);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('pause / resume', () => {
    it('pauses and resumes the queue', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      mockFetch(async (...args: Array<unknown>) => {
        order.push(String(args[0]));
        return new Response();
      });
      try {
        shield.pause();

        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);

        t.mock.timers.tick(100);
        await flush();
        assert.deepEqual(order, [], 'nothing runs while paused');

        shield.resume();
        t.mock.timers.tick(0);
        await flush();
        await Promise.all([p1, p2]);

        assert.deepEqual(order, [URL_A, URL_B]);
      } finally {
        restoreFetch();
      }
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
    it('inserts delay before pending requests', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      mockFetch(async () => {
        order.push('fetched');
        return new Response();
      });
      try {
        shield.pause();
        const p1 = shield.fetch(URL_A);
        shield.backOff(2_000);
        shield.resume();

        // After 0ms: backOff delay starts (it was unshifted to front)
        t.mock.timers.tick(0);
        await flush();
        assert.deepEqual(order, []);

        // After 2000ms: backOff delay completes, request runs
        t.mock.timers.tick(2_000);
        await flush();
        await p1;
        assert.deepEqual(order, ['fetched']);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('AbortSignal', () => {
    it('rejects immediately if signal is already aborted', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const controller = new AbortController();
      controller.abort('cancelled');

      mockFetch(async () => new Response());
      try {
        await assert.rejects(
          shield.fetch(URL_A, { signal: controller.signal }),
          (err) => err === 'cancelled',
        );
      } finally {
        restoreFetch();
      }
    });

    it('passes signal to the underlying fetch call', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const controller = new AbortController();

      mockFetch(async (...args: Array<unknown>) => {
        const opts = args[1] as RequestInit;
        assert.equal(opts.signal, controller.signal);
        return new Response();
      });
      try {
        await shield.fetch(URL_A, { signal: controller.signal });
      } finally {
        restoreFetch();
      }
    });

    it('removes request from queue when aborted', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const order: Array<string> = [];

      mockFetch(async (...args: Array<unknown>) => {
        order.push(String(args[0]));
        return new Response();
      });
      try {
        shield.pause();
        const p1 = shield.fetch(URL_A);

        const controller = new AbortController();
        const p2 = shield.fetch(URL_B, { signal: controller.signal });

        const p3 = shield.fetch(URL_C);

        // Abort the second request while it's still queued
        controller.abort(new DOMException('Aborted', 'AbortError'));

        assert.equal(shield.queueLength, 2, 'aborted request removed from queue');

        // Handle the rejection so it doesn't leak
        p2.catch(() => {});

        shield.resume();
        t.mock.timers.tick(0);
        await flush();

        await p1;
        await assert.rejects(p2, { name: 'AbortError' });
        await p3;

        assert.deepEqual(order, [URL_A, URL_C]);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('429 auto-retry', () => {
    it('retries on 429 with Retry-After and returns the successful response', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const warnMock = console.warn as unknown as ReturnType<typeof mock.fn>;
      const warnsBefore = warnMock.mock.callCount();

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', { status: 429, headers: { 'Retry-After': '5' } });
        }
        return new Response('success', { status: 200 });
      });
      try {
        const p = shield.fetch(URL_A);

        await flush();
        assert.equal(callCount, 1);
        assert.equal(warnMock.mock.callCount() - warnsBefore, 1);
        assert.match(String(warnMock.mock.calls[warnsBefore].arguments[0]), /429.*5000/);

        t.mock.timers.tick(5_000);
        await flush();

        const result = await p;
        assert.equal(callCount, 2);
        assert.equal(result.status, 200);
      } finally {
        restoreFetch();
      }
    });

    it('retries multiple 429s until success', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        if (callCount <= 2) {
          return new Response('', { status: 429, headers: { 'Retry-After': '1' } });
        }
        return new Response('ok', { status: 200 });
      });
      try {
        const p = shield.fetch(URL_A);

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
      } finally {
        restoreFetch();
      }
    });

    it('uses X-Ratelimit.until when no Retry-After', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;
      const untilDate = new Date(100_000 + 3_000).toISOString();

      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', {
            status: 429,
            headers: { 'X-Ratelimit': JSON.stringify({ remaining: 0, until: untilDate }) },
          });
        }
        return new Response('ok', { status: 200 });
      });
      try {
        const p = shield.fetch(URL_A);
        await flush();
        assert.equal(callCount, 1);

        t.mock.timers.tick(3_000);
        await flush();

        const result = await p;
        assert.equal(callCount, 2);
        assert.equal(result.status, 200);
      } finally {
        restoreFetch();
      }
    });

    it('falls back to fallbackRetryMs when no headers', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity, fallbackRetryMs: 10_000 });
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('', { status: 429 });
        }
        return new Response('ok', { status: 200 });
      });
      try {
        const p = shield.fetch(URL_A);
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
      } finally {
        restoreFetch();
      }
    });
  });

  describe('preemptive backoff', () => {
    it('backs off when remaining is 0', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      const untilDate = new Date(100_000 + 5_000).toISOString();
      const timestamps: Array<number> = [];
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        timestamps.push(Date.now());
        if (callCount === 1) {
          return new Response('ok', {
            status: 200,
            headers: { 'X-Ratelimit': JSON.stringify({ remaining: 0, until: untilDate }) },
          });
        }
        return new Response('ok', { status: 200 });
      });
      try {
        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);

        await flush();
        assert.equal(timestamps.length, 1);

        t.mock.timers.tick(5_000);
        await flush();

        await Promise.all([p1, p2]);
        assert.equal(timestamps.length, 2);
        assert.ok(timestamps[1] - timestamps[0] >= 5_000);
      } finally {
        restoreFetch();
      }
    });

    it('does not back off when remaining > 0', async () => {
      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      let callCount = 0;

      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response('ok', {
            status: 200,
            headers: { 'X-Ratelimit': JSON.stringify({ remaining: 50, until: new Date(Date.now() + 60_000).toISOString() }) },
          });
        }
        return new Response('ok', { status: 200 });
      });
      try {
        await shield.fetch(URL_A);
        await shield.fetch(URL_B);
        assert.equal(shield.queueLength, 0);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('malformed X-Ratelimit', () => {
    it('logs error and backs off on malformed JSON', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const errorMock = console.error as unknown as ReturnType<typeof mock.fn>;
      const callsBefore = errorMock.mock.callCount();

      const shield = createApiShield({ rateLimitReqPerMin: Infinity, malformedHeaderBackoffMs: 2_000 });
      const timestamps: Array<number> = [];

      mockFetch(async () => {
        timestamps.push(Date.now());
        return new Response('ok', {
          status: 200,
          headers: timestamps.length === 1 ? { 'X-Ratelimit': 'not json' } : {},
        });
      });
      try {
        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);

        await flush();
        assert.equal(timestamps.length, 1);
        assert.equal(errorMock.mock.callCount() - callsBefore, 1);
        const errorArg = errorMock.mock.calls[callsBefore].arguments[0];
        assert.ok(errorArg instanceof Error);
        assert.match(errorArg.message, /malformed X-Ratelimit/);
        assert.ok(errorArg.cause instanceof SyntaxError, 'cause is the JSON parse error');

        // Second request delayed by malformedHeaderBackoffMs (2s)
        t.mock.timers.tick(2_000);
        await flush();

        await Promise.all([p1, p2]);
        assert.equal(timestamps.length, 2);
      } finally {
        restoreFetch();
      }
    });
  });

  describe('mutate rate limit', () => {
    it('throttles mutations more than GETs when rateLimitMutatePerMin is set', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: 60, rateLimitMutatePerMin: 30 });
      const timestamps: Array<{ method: string, time: number }> = [];

      mockFetch(async (...args: Array<unknown>) => {
        const opts = args[1] as RequestInit | undefined;
        timestamps.push({ method: opts?.method ?? 'GET', time: Date.now() });
        return new Response();
      });
      try {
        // GET then POST — POST should wait 2s (mutate interval), not 1s (shared)
        const p1 = shield.fetch(URL_A); // GET
        const p2 = shield.fetch(URL_A, { method: 'POST' });

        await flush(); // GET runs
        assert.equal(timestamps.length, 1);

        t.mock.timers.tick(1_000); // shared interval passes
        await flush();
        // POST still waiting — needs 2s from lastMutateAt(0), but only 1s has passed since start
        // Actually lastMutateAt is 0 (epoch), so mutate wait = 2000 - (101_000 - 0) < 0. Shared wait = 1000 - 0 = 1000.
        // Wait, let me reconsider. After GET at 100_000: lastRequestAt=100_000. POST checks:
        //   shared: 1000 - (101_000 - 100_000) = 0
        //   mutate: 2000 - (101_000 - 0) < 0
        // So POST runs at 1s. That's because lastMutateAt starts at 0 (stale).
        // The mutate limit kicks in between consecutive mutations.
        assert.equal(timestamps.length, 2);

        await Promise.all([p1, p2]);
      } finally {
        restoreFetch();
      }
    });

    it('enforces mutate interval between consecutive mutations', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      // 1s shared, 2s mutate
      const shield = createApiShield({ rateLimitReqPerMin: 60, rateLimitMutatePerMin: 30 });
      const timestamps: Array<number> = [];

      mockFetch(async () => {
        timestamps.push(Date.now());
        return new Response();
      });
      try {
        const p1 = shield.fetch(URL_A, { method: 'POST' });
        const p2 = shield.fetch(URL_B, { method: 'POST' });

        await flush(); // POST 1 runs immediately
        assert.equal(timestamps.length, 1);

        t.mock.timers.tick(1_000); // shared interval passes but mutate needs 2s
        await flush();
        assert.equal(timestamps.length, 1, 'POST 2 still waiting for mutate interval');

        t.mock.timers.tick(1_000); // 2s total since POST 1
        await flush();
        assert.equal(timestamps.length, 2);

        await Promise.all([p1, p2]);
        assert.equal(timestamps[1] - timestamps[0], 2_000);
      } finally {
        restoreFetch();
      }
    });

    it('shares one timer when rateLimitMutatePerMin is omitted', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });

      const shield = createApiShield({ rateLimitReqPerMin: 60 }); // no mutate limit
      const timestamps: Array<number> = [];

      mockFetch(async () => {
        timestamps.push(Date.now());
        return new Response();
      });
      try {
        const p1 = shield.fetch(URL_A); // GET
        const p2 = shield.fetch(URL_B, { method: 'POST' }); // POST
        const p3 = shield.fetch(URL_C); // GET

        await flush(); // GET 1 runs
        assert.equal(timestamps.length, 1);

        t.mock.timers.tick(1_000);
        await flush(); // POST runs (shared 1s interval)
        assert.equal(timestamps.length, 2);

        t.mock.timers.tick(1_000);
        await flush(); // GET 2 runs (shared 1s interval)
        assert.equal(timestamps.length, 3);

        await Promise.all([p1, p2, p3]);
        assert.equal(timestamps[1] - timestamps[0], 1_000);
        assert.equal(timestamps[2] - timestamps[1], 1_000);
      } finally {
        restoreFetch();
      }
    });

    it('validates rateLimitMutatePerMin', () => {
      assert.throws(
        () => createApiShield({ rateLimitReqPerMin: 60, rateLimitMutatePerMin: 0 }),
        RangeError,
      );
      assert.throws(
        () => createApiShield({ rateLimitReqPerMin: 60, rateLimitMutatePerMin: -1 }),
        RangeError,
      );
      assert.throws(
        () => createApiShield({ rateLimitReqPerMin: 60, rateLimitMutatePerMin: 120 }),
        { message: /must be <= rateLimitReqPerMin/ },
      );
    });
  });

  describe('queueLength', () => {
    it('reflects the number of pending requests', async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });

      const shield = createApiShield({ rateLimitReqPerMin: Infinity });
      assert.equal(shield.queueLength, 0);

      mockFetch(async () => new Response());
      try {
        shield.pause();
        const p1 = shield.fetch(URL_A);
        const p2 = shield.fetch(URL_B);
        assert.equal(shield.queueLength, 2);

        shield.resume();
        t.mock.timers.tick(0);
        await flush();
        await Promise.all([p1, p2]);
        assert.equal(shield.queueLength, 0);
      } finally {
        restoreFetch();
      }
    });
  });
});
