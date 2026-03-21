import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cache } from './cache.ts';

describe('Cache', () => {
  it('returns null when empty', () => {
    const cache = new Cache<string>({ ttlMs: 1_000 });
    assert.equal(cache.get(), null);
  });

  it('returns data when fresh', () => {
    const cache = new Cache<string>({ ttlMs: 1_000 });
    cache.set({ value: 'hello', fetchedAt: new Date() });
    assert.equal(cache.get()?.value, 'hello');
  });

  it('reports stale when TTL exceeded', () => {
    const cache = new Cache<string>({ ttlMs: 1_000 });
    cache.set({ value: 'hello', fetchedAt: new Date(Date.now() - 2_000) });
    assert.equal(cache.isFresh(), false);
    // Still returns data even when stale
    assert.equal(cache.get()?.value, 'hello');
  });

  it('deduplicates concurrent refresh calls', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return 'result';
    };
    const cache = new Cache<string>({ ttlMs: 1_000 });
    const p1 = cache.refresh(fetcher);
    const p2 = cache.refresh(fetcher);
    await Promise.all([p1, p2]);
    assert.equal(fetchCount, 1);
  });

  it('detects when data has changed', () => {
    const cache = new Cache<string>({ ttlMs: 1_000 });
    cache.set({ value: 'A', fetchedAt: new Date() });
    assert.equal(cache.setAndDetectChange({ value: 'B', fetchedAt: new Date() }), true);
  });

  it('detects when data has not changed', () => {
    const cache = new Cache<string>({ ttlMs: 1_000 });
    cache.set({ value: 'A', fetchedAt: new Date() });
    assert.equal(cache.setAndDetectChange({ value: 'A', fetchedAt: new Date(Date.now() + 1_000) }), false);
  });
});
