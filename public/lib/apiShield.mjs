// @ts-check

/**
 * @typedef {{
 *   task: () => any,
 *   resolve: (value: any) => void,
 *   reject: (reason: unknown) => void,
 *   signal?: AbortSignal,
 *   onAbort?: () => void,
 * }} QueueEntry
 */

/**
 * @param {{ rateLimitReqPerMin: number }} options
 */
function createApiShield({ rateLimitReqPerMin }) {
  if (!(rateLimitReqPerMin > 0)) {
    throw new RangeError(`rateLimitReqPerMin must be positive, got ${rateLimitReqPerMin}`);
  }

  const minIntervalMs = rateLimitReqPerMin === Infinity ? 0 : 60_000 / rateLimitReqPerMin;

  /** @type {Array<QueueEntry>} */
  const queue = [];
  let processing = false;
  let paused = false;
  /** @type {Promise<void> | null} */
  let pausePromise = null;
  /** @type {(() => void) | null} */
  let resumeResolve = null;
  let lastRequestAt = 0;

  /** @param {number} ms */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function processQueue() {
    if (processing) {
      return;
    }

    processing = true;
    try {
      while (queue.length > 0) {
        if (pausePromise) {
          await pausePromise;
        }

        const entry = /** @type {QueueEntry} */ (queue.shift());

        // Clean up abort listener since we've dequeued
        if (entry.signal && entry.onAbort) {
          entry.signal.removeEventListener('abort', entry.onAbort);
        }

        // Skip if aborted while waiting in queue
        if (entry.signal?.aborted) {
          entry.reject(entry.signal.reason);
          continue;
        }

        // Rate-limit wait
        const elapsed = Date.now() - lastRequestAt;
        const waitMs = Math.max(0, minIntervalMs - elapsed);
        if (waitMs > 0) {
          await delay(waitMs);
        }

        // Re-check pause after delay
        if (pausePromise) await pausePromise;

        // Re-check abort after waiting
        if (entry.signal?.aborted) {
          entry.reject(entry.signal.reason);
          continue;
        }

        lastRequestAt = Date.now();
        try {
          const result = await entry.task();
          entry.resolve(result);
        } catch (err) {
          entry.reject(err);
        }
      }
    } finally {
      processing = false;
    }
  }

  /**
   * @template T
   * @param {() => T | Promise<T>} task
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<T>}
   */
  function shieldQueue(task, options) {
    const signal = options?.signal;

    // Reject immediately if already aborted
    if (signal?.aborted) {
      return Promise.reject(signal.reason);
    }

    return new Promise((resolve, reject) => {
      /** @type {QueueEntry} */
      const entry = { task, resolve, reject, signal };

      if (signal) {
        const onAbort = () => {
          const index = queue.indexOf(entry);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(signal.reason);
          }
        };
        entry.onAbort = onAbort;
        signal.addEventListener('abort', onAbort, { once: true });
      }

      queue.push(entry);
      processQueue();
    });
  }

  function pause() {
    if (paused) return;
    paused = true;
    pausePromise = new Promise(resolve => { resumeResolve = resolve; });
  }

  function resume() {
    if (!paused) return;
    paused = false;
    const r = resumeResolve;
    resumeResolve = null;
    pausePromise = null;
    r?.();
  }

  /** @param {number} backOffTimeMs */
  function backOff(backOffTimeMs) {
    /** @type {QueueEntry} */
    const entry = {
      task: () => delay(backOffTimeMs),
      resolve: () => {},
      reject: () => {},
    };
    queue.unshift(entry);
    processQueue();
  }

  /**
   * @param {string | URL | Request} url
   * @param {RequestInit} [options]
   * @returns {Promise<Response>}
   */
  function shieldFetch(url, options) {
    const signal = options?.signal;
    return shieldQueue(() => fetch(url, options), { signal });
  }

  return {
    queue: shieldQueue,
    pause,
    resume,
    backOff,
    fetch: shieldFetch,
    get queueLength() {
      return queue.length;
    },
  };
}

export { createApiShield };
