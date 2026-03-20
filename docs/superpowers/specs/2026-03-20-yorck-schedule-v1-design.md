# Yorck Schedule v1.0.0 — Design Spec

## Goal

An alternative web UI for browsing the Yorck cinema chain's schedule. Reverse-engineer the mobile app's API and present the schedule in a fast, reliable, no-nonsense interface.

## Stack

- **Runtime**: Node.js 24 (`.nvmrc` pinned)
- **Server**: TypeScript with native type stripping (`erasableSyntaxOnly` in tsconfig)
- **Client**: Plain HTML, vanilla CSS, vanilla JS (`.mjs` files, JSDoc for types)
- **No build step**: `node src/server.ts` to run
- **No frameworks**: No React, no Express — just `node:http` (or a minimal router if needed)

## Architecture

```
Browser  ──→  Node server  ──→  Cache  ──→  Yorck API
                 │
              Templates (HTML)
              Static assets (CSS, JS)
                 │
              SSE endpoint (update notifications)
```

Three layers:

1. **Yorck API client** (`src/yorck-client.ts`) — fetches schedule data from Yorck's mobile app API, maps responses to internal types
2. **Cache** (`src/cache.ts`) — in-memory cache with configurable TTL, single-inflight deduplication
3. **HTML renderer** (`src/templates/`) — template functions that take data and return HTML strings

## API Discovery (Pre-implementation)

Before writing code, intercept the Yorck mobile app's network traffic:

1. Set up mitmproxy (or Charles) as HTTPS proxy on phone
2. Use the Yorck app, browse schedule, tap into movies
3. Capture and document all relevant endpoints, request params, and response shapes
4. Write findings to `docs/api.md`

Focus on: cinema list, movie list, screenings/showtimes, movie details.

## Data Model

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
  languageInfo: string; // "OmU", "OmeU", "DF", etc. — per-screening, since the same movie can show in different versions
  bookingUrl?: string;
}
```

Exact shapes will be refined after API discovery. A thin mapping layer in `yorck-client.ts` converts API responses into these types, isolating the rest of the app from API changes.

Note: `Cinema.slug` exists for future use (e.g. `/cinemas/:slug` pages in v1.1+). In v1.0.0 cinemas are only displayed as part of screening listings.

## Caching Strategy

- **On request**: if cache is fresh (within TTL), serve from cache
- **On stale request**: serve stale data immediately with a "might be out of date" banner rendered server-side in the HTML, trigger a single background refresh
- **Deduplication**: if a refresh is already in progress, subsequent requests get the stale data — no duplicate API calls
- **On refresh complete**: notify connected clients via SSE:
  - If data changed → client shows "Updated schedule available — refresh"
  - If data unchanged → client silently removes the "might be out of date" banner
- **On cold start with API down**: show "Schedule currently unavailable" message
- **TTL**: configurable, default 15 minutes

### Why not timer-based refresh?

To avoid being rate-limited or blacklisted by Yorck. The API is only called when someone actually uses the site.

## Pages

### `GET /` — Schedule

All movies currently showing, sorted by earliest upcoming screening (soonest first — movies playing today appear at the top). Each movie displays:

- Poster thumbnail, title, metadata (duration, language)
- All upcoming screenings across all cinemas (grouping/layout TBD during implementation)

Clicking a movie title navigates to its detail page.

### `GET /movies/:id` — Movie Detail

Full movie information:

- Poster, title, original title, description, duration, language info
- Complete screening list across all cinemas, grouped by date

### `GET /api/events` — SSE Endpoint

Server-Sent Events stream for cache update notifications. Client connects on page load, listens for:

- `data-changed` — new schedule data available
- `data-unchanged` — cache was refreshed but data is the same

## Client-Side Behavior

### SSE Connection (`public/main.mjs`)

- Open `EventSource` to `/api/events` on page load
- On `data-changed`: show banner "Updated schedule available — refresh" with a link/button
- On `data-unchanged`: remove any "might be out of date" banner silently
- Graceful degradation: if SSE fails, the page still works — user just won't get live update notifications

### Native Browser Features

- `<details>` for expandable sections
- Popover API where appropriate
- View Transition API for poster images (e.g. navigating from list to detail)
- No polyfills — target modern browsers

## Styling

### Design Tokens (CSS Custom Properties on `:root`)

Palette (private, used only to define semantic colors):

```css
--_palette-*          /* Named colors, e.g. --_palette-slate-900 */
```

Semantic tokens:

```css
--color-*             /* Semantic color names, e.g. --color-text, --color-surface, --color-accent */
--spacing-*           /* Spacing scale, e.g. --spacing-xs, --spacing-sm, --spacing-md */
--thickness-*         /* Borders, outlines, separators */
--radius-*            /* Border radii */
--font-size-*         /* Type scale */
--font-weight-*       /* Weight scale */
--line-height-*       /* Line height scale */
--shadow-*            /* Box shadows */
--transition-*        /* Duration/easing tokens */
```

### CSS Approach

- Mobile-first responsive design
- System font stack (no web fonts)
- Dark/light mode via `prefers-color-scheme`, switching palette values
- `scrollbar-gutter: stable both-edges`
- `accent-color` set to match the design's accent
- View Transition API for poster images
- Visual direction (colors, specific aesthetic) to be decided during implementation

## Project Structure

```
yorck/
├── .nvmrc                  # Node 24
├── docs/
│   ├── BRAINDUMP.md
│   └── api.md              # API discovery findings
├── public/
│   ├── styles.css          # All styles, CSS vars
│   └── main.mjs            # Client-side JS (SSE, interactivity)
├── src/
│   ├── server.ts           # HTTP server, routing
│   ├── yorck-client.ts     # Yorck API client + response mapping
│   ├── cache.ts            # In-memory cache, TTL, single-inflight
│   ├── types.ts            # Cinema, Movie, Screening types
│   └── templates/
│       ├── layout.ts       # Shared HTML shell (head, nav, footer)
│       ├── home.ts         # Movie list with screenings
│       └── movie.ts        # Movie detail page
├── package.json
└── tsconfig.json
```

## Out of Scope for v1.0.0

- Personalization (watchlist, watched, not interested)
- Language filtering
- External links (Trakt, Letterboxd)
- Authentication / ticket purchase
- Offline-first / service worker
- Deployment configuration (local dev only)
