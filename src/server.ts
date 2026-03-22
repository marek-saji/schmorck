import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { YORCK_VISTA_API_URL, PORT, APP_URL, TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET, NODE_ENV, COMMIT_SHA } from './lib/env.ts';
import { Cache } from './cache.ts';
import { fetchSchedule } from './yorck-client.ts';
import { homePage } from './templates/home.ts';
import { filmPage } from './templates/film.ts';
import { designSystemPage } from './templates/design-system.ts';
import type { ScheduleData } from './types.ts';

const CACHING_ENABLED = NODE_ENV !== 'development' && !!COMMIT_SHA;
const STATIC_MAX_AGE_S = 30 * 24 * 60 * 60; // 1 month
const HTML_MAX_AGE_S = 5 * 60; // 5 minutes
const TTL_MS = parseInt(process.env.CACHE_TTL_MS ?? String(15 * 60_000), 10);
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');

const cache = new Cache<ScheduleData>({ ttlMs: TTL_MS });
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
  console.log(req.method, req.url);
  const url = new URL(req.url ?? '/', APP_URL);

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
    if (extname(url.pathname) in MIME_TYPES) {
      const filePath = join(PUBLIC_DIR, url.pathname.slice(1));
      try {
        const content = await readFile(filePath);
        const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
        const headers: HeadersInit = { 'Content-Type': mime };
        if (CACHING_ENABLED) {
          headers['ETag'] = `"${COMMIT_SHA}"`;
          headers['Cache-Control'] = `public, max-age=${STATIC_MAX_AGE_S}, immutable`;
        }
        res.writeHead(200, headers);
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

    const entry = cache.get();
    const data = entry?.value;
    const fetchedAt = !cache.isFresh() ? entry?.fetchedAt : undefined;

    // Home page
    if (url.pathname === '/') {
      if (!data) {
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Schedule currently unavailable</h1><p>Please try again shortly.</p></body></html>');
        return;
      }
      const htmlHeaders: HeadersInit = { 'Content-Type': 'text/html; charset=utf-8' };
      if (CACHING_ENABLED && entry) {
        htmlHeaders['ETag'] = `"${entry.fetchedAt.getTime()}"`;
        htmlHeaders['Cache-Control'] = `public, max-age=${HTML_MAX_AGE_S}, must-revalidate`;
      }
      res.writeHead(200, htmlHeaders);
      res.end(homePage({ data, fetchedAt }));
      return;
    }

    // Poster proxy — streams upstream image or serves fallback
    const posterMatch = url.pathname.match(/^\/films\/([^/]+)\/poster$/);
    if (posterMatch) {
      const slug = posterMatch[1];
      const film = data?.films.find(f => f.slug === slug);
      if (!film) {
        const fallback = await readFile(join(PUBLIC_DIR, 'poster-fallback.svg'));
        res.writeHead(404, { 'Content-Type': 'image/svg+xml' });
        res.end(fallback);
        return;
      }
      try {
        const posterUrl = new URL(`/CDN/media/entity/get/Movies/${film.id}`, YORCK_VISTA_API_URL);
        const upstream = await fetch(posterUrl);
        if (upstream.ok && upstream.body) {
          res.writeHead(200, {
            'Content-Type': upstream.headers.get('Content-Type') ?? 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          });
          // @ts-expect-error: web ReadableStream vs node ReadableStream type mismatch
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
      const slug = filmMatch[1];
      const film = data.films.find(f => f.slug === slug);
      if (!film) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Film not found</h1></body></html>');
        return;
      }
      const filmScreenings = data.screenings.filter(s => s.scheduledFilmId === film.id);
      const date = url.searchParams.get('date') ?? undefined;
      const htmlHeaders: HeadersInit = { 'Content-Type': 'text/html; charset=utf-8' };
      if (CACHING_ENABLED && entry) {
        htmlHeaders['ETag'] = `"${entry.fetchedAt.getTime()}"`;
        htmlHeaders['Cache-Control'] = `public, max-age=${HTML_MAX_AGE_S}, must-revalidate`;
      }
      res.writeHead(200, htmlHeaders);
      res.end(filmPage({ film, screenings: filmScreenings, cinemas: data.cinemas, fetchedAt, date }));
      return;
    }

    // Design system
    if (url.pathname === '/design-system') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(designSystemPage());
      return;
    }

    // Trakt OAuth callback — exchange code for tokens, set cookie, redirect
    if (url.pathname === '/auth/trakt/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Missing authorization code</h1></body></html>');
        return;
      }
      try {
        const tokenRes = await fetch('https://api.trakt.tv/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: TRAKT_CLIENT_ID,
            client_secret: TRAKT_CLIENT_SECRET,
            redirect_uri: `${APP_URL}/auth/trakt/callback`,
            grant_type: 'authorization_code',
          }),
        });
        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed: ${tokenRes.status}`);
        }
        const tokens = await tokenRes.json() as { access_token: string; refresh_token: string; expires_in: number };
        const maxAge = tokens.expires_in;
        res.writeHead(302, {
          'Location': '/',
          'Set-Cookie': [
            `trakt_access_token=${tokens.access_token}; Path=/; Max-Age=${maxAge}; SameSite=Strict`,
            `trakt_refresh_token=${tokens.refresh_token}; Path=/; HttpOnly; Max-Age=${maxAge * 4}; SameSite=Strict`,
          ],
        });
        res.end();
      } catch (err) {
        console.error('Trakt OAuth error:', err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Sign in failed</h1></body></html>');
      }
      return;
    }

    // Trakt logout — clear cookies, redirect
    if (url.pathname === '/auth/trakt/logout') {
      res.writeHead(302, {
        'Location': '/',
        'Set-Cookie': [
          'trakt_access_token=; Path=/; Max-Age=0',
          'trakt_refresh_token=; Path=/; Max-Age=0',
        ],
      });
      res.end();
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
  console.log(`Listening on ${APP_URL}`);
  console.log(`Caching: ${CACHING_ENABLED ? `enabled (${COMMIT_SHA})` : 'disabled'}`);
});

export { server };
