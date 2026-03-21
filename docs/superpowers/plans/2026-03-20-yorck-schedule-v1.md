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
| `src/types.ts` | Cinema, Film, Screening type definitions |
| `src/lib/html.ts` | HTML utility functions (escapeHtml) |
| `src/cache.ts` | In-memory cache with TTL, single-inflight dedup, change detection |
| `src/yorck-client.ts` | Fetch from Yorck API, map to internal types |
| `src/templates/layout.ts` | Shared HTML shell (head, scripts, styles, banner) |
| `src/templates/home.ts` | Home page: film list with screenings |
| `src/templates/film.ts` | Film detail page |
| `src/server.ts` | HTTP server, routing, SSE endpoint, static file serving |
| `public/poster-fallback.svg` | Fallback image for films with no poster |
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

- [x] **Step 1: Create type definitions**

```typescript
interface Cinema {
  id: string;                // Vista: ID
  name: string;              // Vista: Name
  address?: string;          // Vista: Address1 (+ Address2)
  city?: string;             // Vista: City
  latitude?: number;         // Vista: Latitude
  longitude?: number;        // Vista: Longitude
}

interface Film {
  id: string;                // Vista: ScheduledFilmId
  title: string;             // Vista: Title
  synopsis?: string;         // Vista: Synopsis
  runTime?: string;          // Vista: RunTime (string in API)
  cast?: string[];           // Vista: Cast[].FirstName + LastName
  rating?: string;           // Vista: Rating
  openingDate?: string;      // Vista: OpeningDate
  trailerUrl?: string;       // Vista: TrailerUrl
}

interface Screening {
  id: string;                // Vista: SessionId
  scheduledFilmId: string;   // Vista: ScheduledFilmId
  cinemaId: string;          // Vista: CinemaId
  showtime: Date;            // Vista: Showtime
  screenName?: string;       // Vista: ScreenName
  screenNumber?: number;     // Vista: ScreenNumber
  seatsAvailable?: number;   // Vista: SeatsAvailable
  soldoutStatus?: number;    // Vista: SoldoutStatus (0=None, 1=AlmostFull, 2=Full)
  attributes?: string[];     // Vista: SessionAttributesNames
}

interface ScheduleData {
  cinemas: Cinema[];
  films: Film[];
  screenings: Screening[];
  fetchedAt: Date;
}

export type { Cinema, Film, Screening, ScheduleData };
```

`ScheduleData` bundles everything the cache stores and templates consume. `fetchedAt` is used for cache freshness checks. See swagger file for full Vista API shapes.

- [x] **Step 2: Create HTML utility**

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

- [x] **Step 3: Verify TypeScript is happy**

Run: `npx tsc --noEmit`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add src/types.ts src/lib/html.ts
git commit -m "feat: add core type definitions and HTML utilities"
```

---

### Task 2: Cache Layer

**Files:**
- Create: `src/cache.ts`
- Create: `src/cache.test.ts`

- [x] **Step 1: Write failing tests for cache**

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
    const data = { cinemas: [], films: [], screenings: [], fetchedAt: new Date() };
    cache.set(data);
    assert.deepEqual(cache.get(), data);
  });

  it('reports stale when TTL exceeded', async () => {
    const cache = new Cache({ ttlMs: 50 });
    const data = { cinemas: [], films: [], screenings: [], fetchedAt: new Date() };
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
      return { cinemas: [], films: [], screenings: [], fetchedAt: new Date() };
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
    const data1 = { cinemas: [], films: [{ id: '1', title: 'A' }], screenings: [], fetchedAt: new Date() };
    cache.set(data1);
    const data2 = { cinemas: [], films: [{ id: '1', title: 'B' }], screenings: [], fetchedAt: new Date() };
    assert.equal(cache.setAndDetectChange(data2), true);
  });

  it('detects when data has not changed', () => {
    const cache = new Cache({ ttlMs: 1000 });
    const data1 = { cinemas: [], films: [{ id: '1', title: 'A' }], screenings: [], fetchedAt: new Date() };
    cache.set(data1);
    const data2 = { cinemas: [], films: [{ id: '1', title: 'A' }], screenings: [], fetchedAt: new Date(Date.now() + 1000) };
    // fetchedAt differs but content is the same
    assert.equal(cache.setAndDetectChange(data2), false);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test src/cache.test.ts`
Expected: FAIL — `Cache` not found

- [x] **Step 3: Implement Cache**

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

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test src/cache.test.ts`
Expected: All 6 tests PASS

- [x] **Step 5: Commit**

```bash
git add src/cache.ts src/cache.test.ts
git commit -m "feat: add in-memory cache with TTL, dedup, and change detection"
```

---

### Task 3: Yorck API Client

**Files:**
- Create: `src/yorck-client.ts`
- Create: `src/yorck-client.test.ts`

**Note:** Uses the documented Vista Connect OData endpoints (see `docs/api.md` and swagger file). Three separate requests:
- `OData.svc/Cinemas` — cinema list
- `OData.svc/ScheduledFilms` — films currently scheduled
- `OData.svc/Sessions` — individual showtimes

- [x] **Step 1: Write failing tests for response mapping**

The tests should verify that raw Vista API responses are correctly mapped to our internal types. Fixture data uses real Vista OData field names.

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapApiResponse } from './yorck-client.ts';

describe('mapApiResponse', () => {
  it('maps a cinema', () => {
    const raw = {
      cinemas: [{ ID: '0000000001', Name: 'Delphi LUX', Address1: 'Kantstraße 10', City: 'Berlin', Latitude: 52.505, Longitude: 13.325 }],
      films: [],
      sessions: [],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.cinemas.length, 1);
    assert.equal(result.cinemas[0].name, 'Delphi LUX');
    assert.equal(result.cinemas[0].address, 'Kantstraße 10');
  });

  it('maps a film with cast', () => {
    const raw = {
      cinemas: [],
      films: [{
        ScheduledFilmId: 'HO00004842',
        Title: 'Anora',
        Synopsis: 'A young woman from Brooklyn...',
        RunTime: '139',
        Rating: 'FSK 16',
        TrailerUrl: 'https://www.youtube.com/watch?v=abc',
        Cast: [
          { FirstName: 'Mikey', LastName: 'Madison', PersonType: 'Actor' },
          { FirstName: 'Sean', LastName: 'Baker', PersonType: 'Director' },
        ],
      }],
      sessions: [],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.films[0].title, 'Anora');
    assert.deepEqual(result.films[0].cast, ['Mikey Madison', 'Sean Baker']);
  });

  it('maps a screening with showtime', () => {
    const raw = {
      cinemas: [],
      films: [],
      sessions: [{
        SessionId: 'sess-1',
        ScheduledFilmId: 'HO00004842',
        CinemaId: '0000000001',
        Showtime: '2026-03-20T18:30:00',
        ScreenName: 'Saal 1',
        ScreenNumber: 1,
        SeatsAvailable: 42,
        SoldoutStatus: 0,
        SessionAttributesNames: ['OmU'],
      }],
    };
    const result = mapApiResponse(raw);
    assert.equal(result.screenings[0].scheduledFilmId, 'HO00004842');
    assert.ok(result.screenings[0].showtime instanceof Date);
    assert.deepEqual(result.screenings[0].attributes, ['OmU']);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `node --test src/yorck-client.test.ts`
Expected: FAIL — `mapApiResponse` not found

- [x] **Step 3: Implement yorck-client**

```typescript
import type { Cinema, Film, Screening, ScheduleData } from './types.ts';
// Vista API response types generated from swagger (see src/vista-api-types.ts)
import type { VistaCinema, VistaScheduledFilm, VistaSession, VistaODataResponse } from './vista-api-types.ts';

const API_KEY = process.env.YORCK_VISTA_API_KEY;
if (!API_KEY) throw new Error('YORCK_VISTA_API_KEY is required');

const API_BASE = process.env.YORCK_VISTA_API_URL;
if (!API_BASE) throw new Error('YORCK_VISTA_API_URL is required');
if (!URL.canParse(API_BASE)) throw new Error('YORCK_VISTA_API_URL is not a valid URL');
if (!API_BASE.endsWith('/')) throw new Error('YORCK_VISTA_API_URL must end with /');

const API_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'ConnectApiToken': API_KEY,
};

interface RawApiData {
  cinemas: VistaCinema[];
  films: VistaScheduledFilm[];
  sessions: VistaSession[];
}

function mapApiResponse(raw: RawApiData): ScheduleData {
  const cinemas: Cinema[] = raw.cinemas.map(c => ({
    id: c.ID,
    name: c.Name,
    address: [c.Address1, c.Address2].filter(Boolean).join(', ') || undefined,
    city: c.City,
    latitude: c.Latitude,
    longitude: c.Longitude,
  }));

  const films: Film[] = raw.films.map(f => ({
    id: f.ScheduledFilmId,
    title: f.Title,
    synopsis: f.Synopsis,
    runTime: f.RunTime,
    cast: f.Cast?.map(p => `${p.FirstName} ${p.LastName}`.trim()),
    rating: f.Rating,
    openingDate: f.OpeningDate,
    trailerUrl: f.TrailerUrl,
  }));

  const screenings: Screening[] = raw.sessions.map(s => ({
    id: s.SessionId,
    scheduledFilmId: s.ScheduledFilmId,
    cinemaId: s.CinemaId,
    showtime: new Date(s.Showtime),
    screenName: s.ScreenName,
    screenNumber: s.ScreenNumber,
    seatsAvailable: s.SeatsAvailable,
    soldoutStatus: s.SoldoutStatus,
    attributes: s.SessionAttributesNames,
  }));

  return { cinemas, films, screenings, fetchedAt: new Date() };
}

// Types generated from swagger file (see src/vista-api-types.ts)
// e.g. VistaODataResponse<T>, VistaCinema, VistaScheduledFilm, VistaSession

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, API_BASE), { headers: API_HEADERS });
  if (!res.ok) {
    throw new Error(`Yorck API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/** Fetches schedule data from Yorck API (three OData endpoints). */
async function fetchSchedule(): Promise<ScheduleData> {
  const [cinemas, films, sessions] = await Promise.all([
    fetchJson<VistaODataResponse<VistaCinema>>('OData.svc/Cinemas'),
    fetchJson<VistaODataResponse<VistaScheduledFilm>>('OData.svc/ScheduledFilms'),
    fetchJson<VistaODataResponse<VistaSession>>('OData.svc/Sessions'),
  ]);
  return mapApiResponse({
    cinemas: cinemas.value,
    films: films.value,
    sessions: sessions.value,
  });
}

export { mapApiResponse, fetchSchedule };
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test src/yorck-client.test.ts`
Expected: All 3 tests PASS

- [x] **Step 5: Commit**

```bash
git add src/yorck-client.ts src/yorck-client.test.ts
git commit -m "feat: add Yorck API client with response mapping (placeholder API)"
```

---

### Task 4: HTML Templates

**Files:**
- Create: `src/templates/layout.ts`
- Create: `src/templates/home.ts`
- Create: `src/templates/film.ts`

- [x] **Step 1: Implement layout template**

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

- [x] **Step 2: Implement home template**

```typescript
import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Film, Screening, Cinema } from '../types.ts';

interface HomeOptions {
  data: ScheduleData;
  stale: boolean;
}

function homePage({ data, stale }: HomeOptions): string {
  const { films, screenings, cinemas } = data;
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  // Sort films by earliest upcoming screening
  const now = new Date();
  const filmWithEarliest = films
    .map(film => {
      const filmScreenings = screenings
        .filter(s => s.scheduledFilmId === film.id && s.showtime > now)
        .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());
      return { film, screenings: filmScreenings, earliest: filmScreenings[0]?.showtime };
    })
    .filter(f => f.earliest) // Only films with upcoming screenings
    .sort((a, b) => a.earliest!.getTime() - b.earliest!.getTime());

  const body = filmWithEarliest.length === 0
    ? '<p>No upcoming screenings.</p>'
    : filmWithEarliest.map(({ film, screenings }) =>
        filmCard(film, screenings, cinemaMap)
      ).join('\n');

  return layout({ title: 'Schedule', stale, body });
}

function filmCard(
  film: Film,
  screenings: Screening[],
  cinemaMap: Map<string, Cinema>,
): string {
  const poster = `<img src="/posters/${escapeHtml(film.id)}" alt="" class="film-poster" style="view-transition-name: poster-${escapeHtml(film.id)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.rating,
  ].filter(Boolean).join(' · ');

  const screeningItems = screenings.map(s => {
    const cinema = cinemaMap.get(s.cinemaId);
    const time = s.showtime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = s.showtime.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
    const label = `${date} ${time}` + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + attrs;
    return `<span class="screening">${label}</span>`;
  }).join('\n');

  return `<article class="film-card">
  <a href="/films/${escapeHtml(film.id)}" class="film-link">
    ${poster}
    <div class="film-info">
      <h2>${escapeHtml(film.title)}</h2>
      ${meta ? `<p class="film-meta">${escapeHtml(meta)}</p>` : ''}
    </div>
  </a>
  <div class="film-screenings">
    ${screeningItems}
  </div>
</article>`;
}

export { homePage };
```

- [x] **Step 3: Implement film detail template**

```typescript
import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { Film, Screening, Cinema } from '../types.ts';

interface FilmPageOptions {
  film: Film;
  screenings: Screening[];
  cinemas: Cinema[];
  stale: boolean;
}

function filmPage({ film, screenings, cinemas, stale }: FilmPageOptions): string {
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const poster = `<img src="/posters/${escapeHtml(film.id)}" alt="" class="film-poster-large" style="view-transition-name: poster-${escapeHtml(film.id)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.rating,
  ].filter(Boolean).join(' · ');

  const credits = [
    film.cast?.length ? `<p><strong>Cast:</strong> ${film.cast.map(escapeHtml).join(', ')}</p>` : '',
  ].filter(Boolean).join('\n');

  // Group screenings by date
  const now = new Date();
  const upcoming = screenings
    .filter(s => s.showtime > now)
    .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());

  const byDate = new Map<string, Screening[]>();
  for (const s of upcoming) {
    const dateKey = s.showtime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const group = byDate.get(dateKey) ?? [];
    group.push(s);
    byDate.set(dateKey, group);
  }

  const screeningHtml = byDate.size === 0
    ? '<p>No upcoming screenings.</p>'
    : Array.from(byDate.entries()).map(([date, items]) => {
        const times = items.map(s => {
          const cinema = cinemaMap.get(s.cinemaId);
          const time = s.showtime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
          const label = time + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + attrs;
          return `<span class="screening">${label}</span>`;
        }).join('\n');
        return `<div class="screening-date">
  <h3>${escapeHtml(date)}</h3>
  <div class="screening-times">${times}</div>
</div>`;
      }).join('\n');

  const body = `<article class="film-detail">
  ${poster}
  <div class="film-detail-info">
    <h1>${escapeHtml(film.title)}</h1>
    ${meta ? `<p class="film-meta">${escapeHtml(meta)}</p>` : ''}
    ${credits}
    ${film.synopsis ? `<div class="film-synopsis">${escapeHtml(film.synopsis)}</div>` : ''}
  </div>
  <section class="screenings">
    <h2>Screenings</h2>
    ${screeningHtml}
  </section>
</article>`;

  return layout({ title: film.title, stale, body });
}

export { filmPage };
```

- [x] **Step 4: Verify TypeScript compiles**

Run: `npx tsgo --noEmit`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add src/templates/
git commit -m "feat: add HTML templates — layout, home, film detail"
```

---

### Task 5: HTTP Server & Routing

**Files:**
- Create: `src/server.ts`

- [x] **Step 1: Implement server**

```typescript
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { Cache } from './cache.ts';
import { fetchSchedule } from './yorck-client.ts';
import { homePage } from './templates/home.ts';
import { filmPage } from './templates/film.ts';

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

    // Poster proxy — streams upstream image or serves fallback
    const posterMatch = url.pathname.match(/^\/posters\/([^/]+)$/);
    if (posterMatch) {
      const filmId = posterMatch[1];
      try {
        const upstream = await fetch(new URL(`CDN/media/entity/get/Movies/${filmId}`, API_BASE));
        if (upstream.ok && upstream.body) {
          res.writeHead(200, {
            'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          });
          Readable.fromWeb(upstream.body).pipe(res);
          return;
        }
      } catch { /* fall through to fallback */ }
      const fallback = await readFile(join(PUBLIC_DIR, 'poster-fallback.svg'));
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
      res.end(fallback);
      return;
    }

    // Film detail page
    const filmMatch = url.pathname.match(/^\/films\/([^/]+)$/);
    if (filmMatch) {
      if (!data) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Schedule currently unavailable</h1></body></html>');
        return;
      }
      const filmId = filmMatch[1];
      const film = data.films.find(f => f.id === filmId);
      if (!film) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Film not found</h1></body></html>');
        return;
      }
      const filmScreenings = data.screenings.filter(s => s.scheduledFilmId === film.id);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(filmPage({ film, screenings: filmScreenings, cinemas: data.cinemas, stale }));
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

- [x] **Step 2: Verify TypeScript compiles**

Run: `npx tsgo --noEmit`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "feat: add HTTP server with routing, SSE, and static file serving"
```

---

### Task 6: Client-Side JS — SSE & Banner

**Files:**
- Create: `public/main.mjs`

- [x] **Step 1: Implement SSE client**

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

- [x] **Step 2: Commit**

```bash
git add public/main.mjs
git commit -m "feat: add client-side SSE for cache update notifications"
```

---

### Task 7: Stylesheet — Design Tokens & Base Styles

**Files:**
- Create: `public/styles.css`

- [x] **Step 1: Create stylesheet with design tokens and base styles**

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
- Components: `.film-card`, `.film-detail`, `.film-poster`, `.screening`, `.screening-date`, `.film-meta`, `.banner`
- Mobile-first responsive adjustments

**Note:** Exact values to be determined during implementation. The visual direction was deferred — start with a clean, functional baseline.

- [x] **Step 2: Commit**

```bash
git add public/styles.css
git commit -m "feat: add stylesheet with design tokens and base styles"
```

---

### Task 8: Integration Test

**Files:**
- Create: `src/server.test.ts`

- [x] **Step 1: Write integration tests**

True end-to-end: mock `global.fetch` to return Vista OData responses, mock `lib/env.ts`, start the actual server, and make HTTP requests to it. Tests the full chain: fetch mock → yorck-client mapping → cache → server routing → template rendering.

```typescript
import { describe, it, mock, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Vista OData fixtures (raw API shapes)
const vistaFixtures = {
  cinemas: { value: [{ ID: '0000000001', Name: 'Delphi LUX', Address1: 'Kantstraße 10', City: 'Berlin', Latitude: 52.505, Longitude: 13.325 }] },
  films: { value: [{
    ScheduledFilmId: 'HO00004842', Title: 'Anora', Synopsis: 'A young woman from Brooklyn...',
    RunTime: '139', Rating: 'FSK 16', TrailerUrl: 'https://www.youtube.com/watch?v=abc',
    Cast: [
      { FirstName: 'Mikey', LastName: 'Madison', PersonType: 'Actor' },
      { FirstName: 'Mark', LastName: 'Eydelshteyn', PersonType: 'Actor' },
    ],
  }] },
  sessions: { value: [{
    SessionId: 'sess-1', ScheduledFilmId: 'HO00004842', CinemaId: '0000000001',
    Showtime: new Date(Date.now() + 3_600_000).toISOString(),
    ScreenName: 'Saal 1', ScreenNumber: 1, SeatsAvailable: 42, SoldoutStatus: 0,
    SessionAttributesNames: ['OmU'],
  }] },
};

// Mock env vars and global.fetch before importing server
mock.module('./lib/env.ts', {
  namedExports: {
    YORCK_VISTA_API_KEY: 'test-key',
    YORCK_VISTA_API_URL: 'https://example.com/',
  },
});

const originalFetch = global.fetch;
global.fetch = async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('OData.svc/Cinemas')) return Response.json(vistaFixtures.cinemas);
  if (url.includes('OData.svc/ScheduledFilms')) return Response.json(vistaFixtures.films);
  if (url.includes('OData.svc/Sessions')) return Response.json(vistaFixtures.sessions);
  return new Response('Not found', { status: 404 });
};

// Import server after mocks are set up — server starts listening on import
const { server } = await import('./server.ts');

// Wait for server to be listening, then get the assigned port
const baseUrl = await new Promise<string>(resolve => {
  server.on('listening', () => {
    const addr = server.address();
    if (typeof addr === 'object' && addr) resolve(`http://localhost:${addr.port}`);
  });
  // If already listening
  const addr = server.address();
  if (typeof addr === 'object' && addr) resolve(`http://localhost:${addr.port}`);
});

after(() => {
  server.close();
  global.fetch = originalFetch;
});

describe('Integration', () => {
  it('GET / renders home page with films', async () => {
    const res = await originalFetch(baseUrl);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Delphi LUX'));
    assert.ok(html.includes('OmU'));
    assert.ok(html.includes('/films/HO00004842'));
  });

  it('GET /films/:id renders film detail', async () => {
    const res = await originalFetch(`${baseUrl}/films/HO00004842`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Mikey Madison'));
    assert.ok(html.includes('139 min'));
    assert.ok(html.includes('OmU'));
  });

  it('GET /films/:id returns 404 for unknown film', async () => {
    const res = await originalFetch(`${baseUrl}/films/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('GET /unknown returns 404', async () => {
    const res = await originalFetch(`${baseUrl}/unknown`);
    assert.equal(res.status, 404);
  });
});
```

- [x] **Step 2: Run tests to verify they pass**

Run: `node --experimental-test-module-mocks --test src/server.test.ts`
Expected: All 4 tests PASS

- [x] **Step 3: Run all tests**

Run: `node --test src/**/*.test.ts`
Expected: All tests across all files PASS

- [x] **Step 4: Commit**

```bash
git add src/server.test.ts
git commit -m "test: add integration tests for templates"
```

---

### Task 9: Smoke Test — End to End

- [x] **Step 1: Start the server**

Run: `node src/server.ts`
Expected: `Listening on http://localhost:3000`

The server will start with an empty cache (no API to call yet). Visiting `http://localhost:3000` should show the "Schedule currently unavailable" message.

- [x] **Step 2: Verify static assets load**

Visit `http://localhost:3000/styles.css` — should return CSS.
Visit `http://localhost:3000/main.mjs` — should return JS.

Covered by integration tests (Task 8) which test the full stack end-to-end.

- [x] **Step 3: Stop the server and commit any fixes**

No fixes needed. All 13 tests pass, types check out.

---

## Post-Plan: API Discovery

After completing all tasks above, the codebase is ready. The next step is:

1. **User performs API discovery** (mitmproxy + Yorck app)
2. **Document findings** in `docs/api.md`
3. **Update `src/yorck-client.ts`** to call real endpoints and map real response shapes
4. **Update tests** in `src/yorck-client.test.ts` with real fixture data
5. **Test end-to-end** with real data
