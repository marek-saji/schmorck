interface CacheOptions {
  ttlMs: number;
}

interface CacheEntry<T> {
  value: T;
  fetchedAt: Date;
}

class Cache<T> {
  private entry: CacheEntry<T> | null = null;
  private ttlMs: number;
  private inflightRefresh: Promise<boolean> | null = null;
  private contentHash: string = '';

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
  }

  get(): CacheEntry<T> | null {
    return this.entry;
  }

  isFresh(): boolean {
    if (!this.entry) return false;
    return Date.now() - this.entry.fetchedAt.getTime() < this.ttlMs;
  }

  set(entry: CacheEntry<T>): void {
    this.entry = entry;
    this.contentHash = this.computeHash(entry.value);
  }

  /** Sets data and returns true if content changed (ignoring fetchedAt). */
  setAndDetectChange(entry: CacheEntry<T>): boolean {
    const newHash = this.computeHash(entry.value);
    const changed = newHash !== this.contentHash;
    this.entry = entry;
    this.contentHash = newHash;
    return changed;
  }

  /** Triggers a refresh, deduplicating concurrent calls. Returns true if data changed. */
  async refresh(fetcher: () => Promise<T>): Promise<boolean> {
    if (this.inflightRefresh) {
      return this.inflightRefresh;
    }
    this.inflightRefresh = fetcher()
      .then(value => this.setAndDetectChange({ value, fetchedAt: new Date() }))
      .finally(() => { this.inflightRefresh = null; });
    return this.inflightRefresh;
  }

  private computeHash(value: T): string {
    return JSON.stringify(value);
  }
}

export { Cache };
export type { CacheOptions, CacheEntry };
