# Yorck Schedule v1.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an alternative web UI for browsing the Yorck cinema chain's schedule, powered by their mobile app's API.

**Architecture:** A plain Node.js HTTP server (no frameworks) that fetches schedule data from Yorck's mobile app API, caches it in-memory, and renders server-side HTML with template literals. Client-side JS handles SSE notifications for cache updates. No build step — run directly with `node src/server.ts`.

**Tech Stack:** Node.js 24, TypeScript (native type stripping, erasableSyntaxOnly), vanilla CSS/JS, `node:http`, `node:test`

---

## Pre-requisite: API Discovery

**This is a manual step.** Before starting implementation, the user must:
1. Set up mitmproxy as HTTPS proxy on their phone
2. Use the Yorck app, browse schedule, view movie details
3. Document endpoints, params, and response shapes in `docs/api.md`

The plan below uses **placeholder API shapes**. After API discovery, Task 2 (yorck-client) will be adapted to the real API.

---

## File Map

| File | Responsibility |
|------|---------------|
| `docs/api.md` | API discovery findings (manually created before implementation) |
| `.gitignore` | Ignore node_modules, .superpowers |
| `.nvmrc` | Node 24 (already exists) |
| `tsconfig.json` | erasableSyntaxOnly, strict, Node module resolution |
| `package.json` | Scripts: start, dev, test (already exists, update scripts) |
| `src/types.ts` | Cinema, Movie, Screening type definitions |
| `src/lib/html.ts` | HTML utility functions (escapeHtml) |
| `src/cache.ts` | In-memory cache with TTL, single-inflight dedup, change detection |
| `src/yorck-client.ts` | Fetch from Yorck API, map to internal types |
| `src/templates/layout.ts` | Shared HTML shell (head, scripts, styles, banner) |
| `src/templates/home.ts` | Home page: movie list with screenings |
| `src/templates/movie.ts` | Movie detail page |
| `src/server.ts` | HTTP server, routing, SSE endpoint, static file serving |
| `public/styles.css` | All styles, CSS custom properties / design tokens |
| `public/main.mjs` | SSE connection, banner updates |
| `src/cache.test.ts` | Tests for cache behavior |
| `src/yorck-client.test.ts` | Tests for API response mapping |
| `src/server.test.ts` | Integration tests for routes |

---

### Task 0: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `tsconfig.json`
- Modify: `package.json`

- [x] **Step 1: Create `.gitignore`**

```
node_modules/
.superpowers/
```

- [x] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2024",
    "module": "Node16",
    "moduleResolution": "Node16",
    "erasableSyntaxOnly": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [x] **Step 3: Update `package.json` scripts**

```json
{
  "type": "module",
  "scripts": {
    "start": "node src/server.ts",
    "dev": "node --watch src/server.ts",
    "test": "node --test 'src/**/*.test.ts'"
  }
}
```

Add `"type": "module"` for ESM. No dependencies needed yet.

- [x] **Step 4: Verify setup**

Run: `node -e "console.log('ok')"`
Expected: `ok` (confirms Node 24 is active)

- [x] **Step 5: Commit**

```bash
git add .gitignore tsconfig.json package.json
git commit -m "chore: project scaffolding — tsconfig, gitignore, package scripts"
```

---

### Task 1: Type Definitions & Utilities

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/html.ts`

- [ ] **Step 1: Create type definitions**

```typescript
interface Cinema {
  id: string;
  name: string;
  slug: string;
  address?: string;
}

interface Movie {
  id: string;
  title: string;
  originalTitle?: string;
  slug: string;
  posterUrl?: string;
  description?: string;
  durationMinutes?: number;
  director?: string;
  cast?: string[];
  writer?: string;
  year?: number;
  country?: string;
  originalLanguages?: string[];
}

interface Screening {
  movieId: string;
  cinemaId: string;
  datetime: Date;
  languageInfo: string;
  bookingUrl?: string;
}

interface ScheduleData {
  cinemas: Cinema[];
  movies: Movie[];
  screenings: Screening[];
  fetchedAt: Date;
}

export type { Cinema, Movie, Screening, ScheduleData };
```

`ScheduleData` bundles everything the cache stores and templates consume. `fetchedAt` is used for cache freshness checks.

- [ ] **Step 2: Create HTML utility**

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { escapeHtml };
```

- [ ] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/html.ts
git commit -m "feat: add core type definitions and HTML utilities"
```

---

### Task 2: Cache Layer

**Files:**
- Create: `src/cache.ts`
- Create: `src/cache.test.ts`

- [ ] **Step 1: Write failing tests for cache**

```typescript
import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Cache } from './cache.ts';

describe('Cache', () => {
  it('returns null when empty', () => {
    const cache = new Cache({ ttlMs: 1000 });
    assert.equal(cache.get(), null);
  });

  it('returns data when fresh', () => {
    const cache = new Cache({ ttlMs: 1000 });
    const data = { cinemas: [], movies: [], screenings: [], fetchedAt: new Date() };
    cache.set(data);
    assert.deepEqual(cache.get(), data);
  });

  it('reports stale when TTL exceeded', async () => {
    const cache = new Cache({ ttlMs: 50 });
    const data = { cinemas: [], movies: [], screenings: [], fetchedAt: new Date() };
    cache.set(data);
    await new Promise(r => setTimeout(r, 60));
    assert.equal(cache.isFresh(), false);
    // Still returns data even when stale
    assert.deepEqual(cache.get(), data);
  });

  it('deduplicates concurrent refresh calls', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      await new Promise(r => setTimeout(r, 50));
      return { cinemas: [], movies: [], screenings: [], fetchedAt: new Date() };
    };
    const cache = new Cache({ ttlMs: 1000 });
    // Trigger two refreshes concurrently
    const p1 = cache.refresh(fetcher);
    const p2 = cache.refresh(fetcher);
    await Promise.all([p1, p2]);
    assert.equal(fetchCount, 1);
  });

  it('detects when data has changed', () => {
    const cache = new Cache({ ttlMs: 1000 });
    const data1 = { cinemas: [], movies: [{ id: '1', title: 'A', slug: 'a' }], screenings: [], fetchedAt: new Date() };
    cache.set(data1);
    const data2 = { cinemas: [], movies: [{ id: '1', title: 'B', slug: 'b' }], screenings: [], fetchedAt: new Date() };
    assert.equal(cache.setAndDetectChange(data2), true);
  });

  it('detects when data has not changed', () => {
    const cache = new Cache({ ttlMs: 1000 });
    const data1 = { cinemas: [], movies: [{ id: '1', title: 'A', slug: 'a' }], screenings: [], fetchedAt: new Date() };
    cache.set(data1);
    const data2 = { cinemas: [], movies: [{ id: '1', title: 'A', slug: 'a' }], screenings: [], fetchedAt: new Date(Date.now() + 1000) };
    // fetchedAt differs but content is the same
    assert.equal(cache.setAndDetectChange(data2), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/cache.test.ts`
Expected: FAIL — `Cache` not found

- [ ] **Step 3: Implement Cache**

```typescript
import type { ScheduleData } from './types.ts';

interface CacheOptions {
  ttlMs: number;
}

class Cache {
  private data: ScheduleData | null = null;
  private setAt: number = 0;
  private ttlMs: number;
  private inflightRefresh: Promise<boolean> | null = null;
  private contentHash: string = '';

  constructor(options: CacheOptions) {
    this.ttlMs = options.ttlMs;
  }

  get(): ScheduleData | null {
    return this.data;
  }

  isFresh(): boolean {
    if (!this.data) return false;
    return Date.now() - this.setAt < this.ttlMs;
  }

  set(data: ScheduleData): void {
    this.data = data;
    this.setAt = Date.now();
    this.contentHash = this.computeHash(data);
  }

  /** Sets data and returns true if content changed (ignoring fetchedAt). */
  setAndDetectChange(data: ScheduleData): boolean {
    const newHash = this.computeHash(data);
    const changed = newHash !== this.contentHash;
    this.data = data;
    this.setAt = Date.now();
    this.contentHash = newHash;
    return changed;
  }

  /** Triggers a refresh, deduplicating concurrent calls. Returns true if data changed. */
  async refresh(fetcher: () => Promise<ScheduleData>): Promise<boolean> {
    if (this.inflightRefresh) {
      return this.inflightRefresh;
    }
    this.inflightRefresh = fetcher()
      .then(data => this.setAndDetectChange(data))
      .finally(() => { this.inflightRefresh = null; });
    return this.inflightRefresh;
  }

  private computeHash(data: ScheduleData): string {
    // Compare everything except fetchedAt
    const { fetchedAt, ...rest } = data;
    return JSON.stringify(rest);
  }
}

export { Cache };
export type { CacheOptions };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/cache.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/cache.ts src/cache.test.ts
git commit -m "feat: add in-memory cache with TTL, dedup, and change detection"
```

---

### Task 3: Yorck API Client

**Files:**
- Create: `src/yorck-client.ts`
- Create: `src/yorck-client.test.ts`

**Note:** This task uses **placeholder API shapes**. After API discovery (`docs/api.md`), update the `mapApiResponse` function and tests to match real responses. The rest of the app is insulated from changes here.

- [ ] **Step 1: Write failing tests for response mapping**

The tests should verify that raw API responses are correctly mapped to our internal types. Use fixture data that mimics the expected API shape (to be replaced with real shapes after discovery).

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapApiResponse } from './yorck-client.ts';

describe('mapApiResponse', () => {
  it('maps a cinema', () => {
    const raw = {
      cinemas: [{ id: '1', name: 'Delphi LUX', slug: 'delphi-lux' }],
      movies: [],
      screenings: [],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.cinemas.length, 1);
    assert.equal(result.cinemas[0].name, 'Delphi LUX');
  });

  it('maps a movie with all fields', () => {
    const raw = {
      cinemas: [],
      movies: [{
        id: '42',
        title: 'Anora',
        originalTitle: 'Anora',
        slug: 'anora',
        posterUrl: 'https://example.com/poster.jpg',
        description: 'A young woman from Brooklyn...',
        durationMinutes: 139,
        director: 'Sean Baker',
        cast: ['Mikey Madison', 'Mark Eydelshteyn'],
        writer: 'Sean Baker',
        year: 2024,
        country: 'USA',
        originalLanguages: ['en', 'ru'],
      }],
      screenings: [],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.movies[0].title, 'Anora');
    assert.equal(result.movies[0].director, 'Sean Baker');
    assert.deepEqual(result.movies[0].cast, ['Mikey Madison', 'Mark Eydelshteyn']);
  });

  it('maps a screening with datetime', () => {
    const raw = {
      cinemas: [],
      movies: [],
      screenings: [{
        movieId: '42',
        cinemaId: '1',
        datetime: '2026-03-20T18:30:00+01:00',
        languageInfo: 'OmU',
        bookingUrl: 'https://yorck.de/book/123',
      }],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.screenings[0].movieId, '42');
    assert.ok(result.screenings[0].datetime instanceof Date);
    assert.equal(result.screenings[0].languageInfo, 'OmU');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/yorck-client.test.ts`
Expected: FAIL — `mapApiResponse` not found

- [ ] **Step 3: Implement yorck-client**

```typescript
import type { Cinema, Movie, Screening, ScheduleData } from './types.ts';

// TODO: Replace with real Yorck API base URL after discovery
const API_BASE = 'https://api.yorck.de';

/** Maps raw API response to internal types. Adapt after API discovery. */
function mapApiResponse(raw: any): ScheduleData {
  const cinemas: Cinema[] = (raw.cinemas ?? []).map((c: any) => ({
    id: String(c.id),
    name: c.name,
    slug: c.slug,
    address: c.address,
  }));

  const movies: Movie[] = (raw.movies ?? []).map((m: any) => ({
    id: String(m.id),
    title: m.title,
    originalTitle: m.originalTitle,
    slug: m.slug,
    posterUrl: m.posterUrl,
    description: m.description,
    durationMinutes: m.durationMinutes,
    director: m.director,
    cast: m.cast,
    writer: m.writer,
    year: m.year,
    country: m.country,
    originalLanguages: m.originalLanguages,
  }));

  const screenings: Screening[] = (raw.screenings ?? []).map((s: any) => ({
    movieId: String(s.movieId),
    cinemaId: String(s.cinemaId),
    datetime: new Date(s.datetime),
    languageInfo: s.languageInfo,
    bookingUrl: s.bookingUrl,
  }));

  return { cinemas, movies, screenings, fetchedAt: new Date() };
}

/** Fetches schedule data from Yorck API. */
async function fetchSchedule(): Promise<ScheduleData> {
  // TODO: Replace with real endpoint(s) after API discovery
  // May need multiple requests (cinemas, movies, screenings separately)
  const res = await fetch(`${API_BASE}/schedule`);
  if (!res.ok) {
    throw new Error(`Yorck API error: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  return mapApiResponse(raw);
}

export { mapApiResponse, fetchSchedule };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/yorck-client.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/yorck-client.ts src/yorck-client.test.ts
git commit -m "feat: add Yorck API client with response mapping (placeholder API)"
```

---

### Task 4: HTML Templates

**Files:**
- Create: `src/templates/layout.ts`
- Create: `src/templates/home.ts`
- Create: `src/templates/movie.ts`

- [ ] **Step 1: Implement layout template**

The shared HTML shell. All pages use this. The `stale` flag controls whether the "might be out of date" banner is rendered.

```typescript
import { escapeHtml } from '../lib/html.ts';

interface LayoutOptions {
  title: string;
  stale?: boolean;
  body: string;
}

function layout({ title, stale = false, body }: LayoutOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Yorck Alt</title>
  <link rel="stylesheet" href="/styles.css">
  <meta name="view-transition" content="same-origin">
</head>
<body>
  <header>
    <a href="/">Yorck Alt</a>
  </header>
  <div id="banner" class="banner"${stale ? '' : ' hidden'}>
    <p id="banner-text">Schedule might be out of date</p>
  </div>
  <main>${body}</main>
  <script type="module" src="/main.mjs"></script>
</body>
</html>`;
}

export { layout };
export type { LayoutOptions };
```

- [ ] **Step 2: Implement home template**

```typescript
import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Movie, Screening, Cinema } from '../types.ts';

interface HomeOptions {
  data: ScheduleData;
  stale: boolean;
}

function homePage({ data, stale }: HomeOptions): string {
  const { movies, screenings, cinemas } = data;
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  // Sort movies by earliest upcoming screening
  const now = new Date();
  const movieWithEarliest = movies
    .map(movie => {
      const movieScreenings = screenings
        .filter(s => s.movieId === movie.id && s.datetime > now)
        .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
      return { movie, screenings: movieScreenings, earliest: movieScreenings[0]?.datetime };
    })
    .filter(m => m.earliest) // Only movies with upcoming screenings
    .sort((a, b) => a.earliest!.getTime() - b.earliest!.getTime());

  const body = movieWithEarliest.length === 0
    ? '<p>No upcoming screenings.</p>'
    : movieWithEarliest.map(({ movie, screenings }) =>
        movieCard(movie, screenings, cinemaMap)
      ).join('\n');

  return layout({ title: 'Schedule', stale, body });
}

function movieCard(
  movie: Movie,
  screenings: Screening[],
  cinemaMap: Map<string, Cinema>,
): string {
  const poster = movie.posterUrl
    ? `<img src="${escapeHtml(movie.posterUrl)}" alt="" class="movie-poster" style="view-transition-name: poster-${escapeHtml(movie.id)}">`
    : '<div class="movie-poster-placeholder"></div>';

  const meta = [
    movie.durationMinutes ? `${movie.durationMinutes} min` : null,
    movie.year ? String(movie.year) : null,
    movie.director,
  ].filter(Boolean).join(' · ');

  const screeningItems = screenings.map(s => {
    const cinema = cinemaMap.get(s.cinemaId);
    const time = s.datetime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = s.datetime.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    const label = `${date} ${time}` + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + ` ${escapeHtml(s.languageInfo)}`;
    return s.bookingUrl
      ? `<a href="${escapeHtml(s.bookingUrl)}" class="screening">${label}</a>`
      : `<span class="screening">${label}</span>`;
  }).join('\n');

  return `<article class="movie-card">
  <a href="/movies/${escapeHtml(movie.slug)}" class="movie-link">
    ${poster}
    <div class="movie-info">
      <h2>${escapeHtml(movie.title)}</h2>
      ${meta ? `<p class="movie-meta">${escapeHtml(meta)}</p>` : ''}
    </div>
  </a>
  <div class="movie-screenings">
    ${screeningItems}
  </div>
</article>`;
}

export { homePage };
```

- [ ] **Step 3: Implement movie detail template**

```typescript
import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Movie, Screening, Cinema } from '../types.ts';

interface MoviePageOptions {
  movie: Movie;
  screenings: Screening[];
  cinemas: Cinema[];
  stale: boolean;
}

function moviePage({ movie, screenings, cinemas, stale }: MoviePageOptions): string {
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const poster = movie.posterUrl
    ? `<img src="${escapeHtml(movie.posterUrl)}" alt="" class="movie-poster-large" style="view-transition-name: poster-${escapeHtml(movie.id)}">`
    : '';

  const meta = [
    movie.durationMinutes ? `${movie.durationMinutes} min` : null,
    movie.year ? String(movie.year) : null,
    movie.country,
  ].filter(Boolean).join(' · ');

  const credits = [
    movie.director ? `<p><strong>Director:</strong> ${escapeHtml(movie.director)}</p>` : '',
    movie.writer ? `<p><strong>Writer:</strong> ${escapeHtml(movie.writer)}</p>` : '',
    movie.cast?.length ? `<p><strong>Cast:</strong> ${movie.cast.map(escapeHtml).join(', ')}</p>` : '',
    movie.originalLanguages?.length ? `<p><strong>Language:</strong> ${movie.originalLanguages.map(escapeHtml).join(', ')}</p>` : '',
  ].filter(Boolean).join('\n');

  // Group screenings by date
  const now = new Date();
  const upcoming = screenings
    .filter(s => s.datetime > now)
    .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

  const byDate = new Map<string, Screening[]>();
  for (const s of upcoming) {
    const dateKey = s.datetime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const group = byDate.get(dateKey) ?? [];
    group.push(s);
    byDate.set(dateKey, group);
  }

  const screeningHtml = byDate.size === 0
    ? '<p>No upcoming screenings.</p>'
    : Array.from(byDate.entries()).map(([date, items]) => {
        const times = items.map(s => {
          const cinema = cinemaMap.get(s.cinemaId);
          const time = s.datetime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const label = time + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + ` ${escapeHtml(s.languageInfo)}`;
          return s.bookingUrl
            ? `<a href="${escapeHtml(s.bookingUrl)}" class="screening">${label}</a>`
            : `<span class="screening">${label}</span>`;
        }).join('\n');
        return `<div class="screening-date">
  <h3>${escapeHtml(date)}</h3>
  <div class="screening-times">${times}</div>
</div>`;
      }).join('\n');

  const body = `<article class="movie-detail">
  ${poster}
  <div class="movie-detail-info">
    <h1>${escapeHtml(movie.title)}</h1>
    ${movie.originalTitle && movie.originalTitle !== movie.title ? `<p class="original-title">${escapeHtml(movie.originalTitle)}</p>` : ''}
    ${meta ? `<p class="movie-meta">${escapeHtml(meta)}</p>` : ''}
    ${credits}
    ${movie.description ? `<div class="movie-description">${escapeHtml(movie.description)}</div>` : ''}
  </div>
  <section class="screenings">
    <h2>Screenings</h2>
    ${screeningHtml}
  </section>
</article>`;

  return layout({ title: movie.title, stale, body });
}

export { moviePage };
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/templates/
git commit -m "feat: add HTML templates — layout, home, movie detail"
```

---

### Task 5: HTTP Server & Routing

**Files:**
- Create: `src/server.ts`

- [ ] **Step 1: Implement server**

```typescript
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { Cache } from './cache.ts';
import { fetchSchedule } from './yorck-client.ts';
import { homePage } from './templates/home.ts';
import { moviePage } from './templates/movie.ts';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const TTL_MS = parseInt(process.env.CACHE_TTL_MS ?? String(15 * 60 * 1000), 10);
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

const cache = new Cache({ ttlMs: TTL_MS });
const sseClients = new Set<import('node:http').ServerResponse>();

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

function triggerRefreshIfStale(): void {
  if (cache.isFresh()) return;
  cache.refresh(fetchSchedule).then(changed => {
    const event = changed ? 'data-changed' : 'data-unchanged';
    for (const client of sseClients) {
      client.write(`event: ${event}\ndata: {}\n\n`);
    }
  }).catch(err => {
    console.error('Background refresh failed:', err);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  try {
    // SSE endpoint
    if (url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(':\n\n'); // comment to establish connection
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // Static files
    if (url.pathname.startsWith('/public/') || url.pathname === '/styles.css' || url.pathname === '/main.mjs') {
      const filePath = url.pathname.startsWith('/public/')
        ? join(PUBLIC_DIR, url.pathname.slice('/public/'.length))
        : join(PUBLIC_DIR, url.pathname.slice(1));
      try {
        const content = await readFile(filePath);
        const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // On cold start (empty cache), await the first fetch
    if (!cache.get()) {
      try {
        await cache.refresh(fetchSchedule);
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    } else {
      triggerRefreshIfStale();
    }

    const data = cache.get();
    const stale = !cache.isFresh();

    // Home page
    if (url.pathname === '/') {
      if (!data) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Schedule currently unavailable</h1><p>Please try again shortly.</p></body></html>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(homePage({ data, stale }));
      return;
    }

    // Movie detail page
    const movieMatch = url.pathname.match(/^\/movies\/([^/]+)$/);
    if (movieMatch) {
      if (!data) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Schedule currently unavailable</h1></body></html>');
        return;
      }
      const slug = movieMatch[1];
      const movie = data.movies.find(m => m.slug === slug);
      if (!movie) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Movie not found</h1></body></html>');
        return;
      }
      const movieScreenings = data.screenings.filter(s => s.movieId === movie.id);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(moviePage({ movie, screenings: movieScreenings, cinemas: data.cinemas, stale }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body><h1>Not found</h1></body></html>');

  } catch (err) {
    console.error('Request error:', err);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body><h1>Internal server error</h1></body></html>');
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add HTTP server with routing, SSE, and static file serving"
```

---

### Task 6: Client-Side JS — SSE & Banner

**Files:**
- Create: `public/main.mjs`

- [ ] **Step 1: Implement SSE client**

```javascript
// @ts-check

/** @type {HTMLElement | null} */
const banner = document.getElementById('banner');
/** @type {HTMLElement | null} */
const bannerText = document.getElementById('banner-text');

const events = new EventSource('/api/events');

events.addEventListener('data-changed', () => {
  if (!banner || !bannerText) return;
  bannerText.innerHTML = 'Updated schedule available — <a href="">refresh</a>';
  banner.hidden = false;
});

events.addEventListener('data-unchanged', () => {
  if (!banner) return;
  banner.hidden = true;
});

events.onerror = () => {
  // Graceful degradation: SSE fails, page still works
  console.warn('SSE connection lost. Live updates unavailable.');
};
```

- [ ] **Step 2: Commit**

```bash
git add public/main.mjs
git commit -m "feat: add client-side SSE for cache update notifications"
```

---

### Task 7: Stylesheet — Design Tokens & Base Styles

**Files:**
- Create: `public/styles.css`

- [ ] **Step 1: Create stylesheet with design tokens and base styles**

Define the full token system and enough base styles to make the pages functional. Visual polish is deferred — focus on structure and readability.

The stylesheet should include:
- `:root` with `--_palette-*` colors
- Semantic tokens: `--color-*`, `--spacing-*`, `--thickness-*`, `--radius-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`, `--shadow-*`, `--transition-*`
- `prefers-color-scheme` dark/light switching (redefine `--color-*` by swapping palette values)
- `scrollbar-gutter: stable both-edges` on `html`
- `accent-color` on `:root`
- System font stack
- Base element styles (body, headings, links, img)
- Layout: header, main, banner
- Components: `.movie-card`, `.movie-detail`, `.movie-poster`, `.screening`, `.screening-date`, `.movie-meta`, `.banner`
- Mobile-first responsive adjustments

**Note:** Exact values to be determined during implementation. The visual direction was deferred — start with a clean, functional baseline.

- [ ] **Step 2: Commit**

```bash
git add public/styles.css
git commit -m "feat: add stylesheet with design tokens and base styles"
```

---

### Task 8: Integration Test

**Files:**
- Create: `src/server.test.ts`

- [ ] **Step 1: Write integration tests**

Test that the server responds correctly to requests with mock data. Since we can't hit the real Yorck API in tests, the test should pre-populate the cache with fixture data and verify HTML responses.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ScheduleData } from './types.ts';

// Test fixture
const fixture: ScheduleData = {
  cinemas: [{ id: '1', name: 'Delphi LUX', slug: 'delphi-lux' }],
  movies: [{
    id: '42', title: 'Anora', slug: 'anora', originalTitle: 'Anora',
    durationMinutes: 139, director: 'Sean Baker', year: 2024,
  }],
  screenings: [{
    movieId: '42', cinemaId: '1',
    datetime: new Date(Date.now() + 3600000), // 1 hour from now
    languageInfo: 'OmU',
    bookingUrl: 'https://yorck.de/book/123',
  }],
  fetchedAt: new Date(),
};

describe('Server routes', () => {
  // NOTE: These tests will need the server refactored to accept
  // an injected cache (instead of module-level singleton) for clean testing.
  // For now, test templates directly as a unit test.

  it('home template renders movies', async () => {
    const { homePage } = await import('./templates/home.ts');
    const html = homePage({ data: fixture, stale: false });
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Delphi LUX'));
    assert.ok(html.includes('OmU'));
    assert.ok(html.includes('/movies/anora'));
    assert.ok(html.includes('id="banner" class="banner" hidden'), 'banner should have hidden attribute when not stale');
  });

  it('home template shows stale banner', async () => {
    const { homePage } = await import('./templates/home.ts');
    const html = homePage({ data: fixture, stale: true });
    assert.ok(html.includes('id="banner" class="banner">'), 'banner should not have hidden attribute when stale');
    assert.ok(html.includes('might be out of date'));
  });

  it('movie template renders details', async () => {
    const { moviePage } = await import('./templates/movie.ts');
    const html = moviePage({
      movie: fixture.movies[0],
      screenings: fixture.screenings,
      cinemas: fixture.cinemas,
      stale: false,
    });
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Sean Baker'));
    assert.ok(html.includes('139 min'));
    assert.ok(html.includes('OmU'));
  });

  it('home template handles empty schedule', async () => {
    const { homePage } = await import('./templates/home.ts');
    const emptyData: ScheduleData = {
      cinemas: [], movies: [], screenings: [], fetchedAt: new Date(),
    };
    const html = homePage({ data: emptyData, stale: false });
    assert.ok(html.includes('No upcoming screenings'));
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `node --test src/server.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 3: Run all tests**

Run: `node --test src/**/*.test.ts`
Expected: All tests across all files PASS

- [ ] **Step 4: Commit**

```bash
git add src/server.test.ts
git commit -m "test: add integration tests for templates"
```

---

### Task 9: Smoke Test — End to End

- [ ] **Step 1: Start the server**

Run: `node src/server.ts`
Expected: `Listening on http://localhost:3000`

The server will start with an empty cache (no API to call yet). Visiting `http://localhost:3000` should show the "Schedule currently unavailable" message.

- [ ] **Step 2: Verify static assets load**

Visit `http://localhost:3000/styles.css` — should return CSS.
Visit `http://localhost:3000/main.mjs` — should return JS.

- [ ] **Step 3: Stop the server and commit any fixes**

If anything needed fixing, commit the fixes. Otherwise, no commit needed.

---

## Post-Plan: API Discovery

After completing all tasks above, the codebase is ready. The next step is:

1. **User performs API discovery** (mitmproxy + Yorck app)
2. **Document findings** in `docs/api.md`
3. **Update `src/yorck-client.ts`** to call real endpoints and map real response shapes
4. **Update tests** in `src/yorck-client.test.ts` with real fixture data
5. **Test end-to-end** with real data
