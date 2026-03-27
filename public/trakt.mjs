// @ts-check

import { createApiShield } from './lib/apiShield.mjs';

const TRAKT_API = 'https://api.trakt.tv';
const CACHE_TTL_MS = 15 * 60_000;

// https://trakt.docs.apiary.io/#introduction/required-headers
// GET: 1000 req / 5 min, mutations: 1 req / sec
// Halved because server and client may share the same IP.
const traktShield = createApiShield({
  rateLimitReqPerMin: 100,
  rateLimitMutatePerMin: 30,
});

const meta = JSON.parse(document.querySelector('meta[name="trakt"]')?.getAttribute('content') ?? '{}');
const accessToken = document.cookie.match(/(?:^|;\s*)trakt_access_token=([^;]*)/)?.[1];

// ── Auth UI ──

const userEl = document.getElementById('trakt-user');
if (userEl) {
  if (accessToken) {
    try {
      const res = await traktFetch('/users/me');
      if (res.ok) {
        const user = await res.json();
        const avatar = user.images?.avatar?.full;
        userEl.innerHTML = `
          ${avatar ? `<img src="${avatar}" alt="" class="trakt-avatar">` : ''}
          <span class="trakt-username">${user.username}</span>
          <a href="/auth/trakt/logout" class="trakt-logout">Sign out</a>
        `;
      } else {
        showSignIn();
      }
    } catch {
      showSignIn();
    }
  } else {
    showSignIn();
  }
}

function showSignIn() {
  if (!userEl || !meta.clientId) return;
  const authorizeUrl = `https://trakt.tv/oauth/authorize?${new URLSearchParams({
    client_id: meta.clientId,
    redirect_uri: meta.redirectUri,
    response_type: 'code',
  })}`;
  userEl.innerHTML = `<a href="${authorizeUrl}" class="trakt-signin">Sign in to Trakt.tv <img src="/images/services/trakt.svg" alt="" class="trakt-signin-icon"></a>`;
}

// ── Watchlist & Watched ──

if (accessToken) {
  const [watchlist, watched] = await Promise.all([
    cachedFetch('trakt_watchlist', '/sync/watchlist/movies'),
    cachedFetch('trakt_watched', '/sync/watched/movies'),
  ]);

  /** @type {Set<number>} */
  const watchlistIds = new Set(watchlist?.map((/** @type {any} */ w) => w.movie.ids.trakt) ?? []);
  /** @type {Set<number>} */
  const watchedIds = new Set(watched?.map((/** @type {any} */ w) => w.movie.ids.trakt) ?? []);

  /** @type {NodeListOf<HTMLElement>} */
  const cards = document.querySelectorAll('.film-card[data-trakt-id]');
  for (const card of cards) {
    const traktId = Number(card.dataset.traktId);
    card.dataset.watched = String(watchedIds.has(traktId));
    card.dataset.watchlist = String(watchlistIds.has(traktId));
    card.dataset.ignore = 'false';

    // Bookmark button
    const btn = document.createElement('button');
    btn.className = 'watchlist-btn';
    btn.setAttribute('aria-label', 'Toggle watchlist');
    updateBookmark(btn, watchlistIds.has(traktId));

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOn = watchlistIds.has(traktId);
      btn.disabled = true;

      const endpoint = isOn ? '/sync/watchlist/remove' : '/sync/watchlist';
      const res = await traktFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ movies: [{ ids: { trakt: traktId } }] }),
      });

      if (res.ok) {
        if (isOn) {
          watchlistIds.delete(traktId);
        } else {
          watchlistIds.add(traktId);
        }
        // Update bookmark buttons only (don't change data-* to avoid reordering)
        for (const c of document.querySelectorAll(`.film-card[data-trakt-id="${traktId}"]`)) {
          const b = c.querySelector('.watchlist-btn');
          if (b) updateBookmark(/** @type {HTMLButtonElement} */ (b), watchlistIds.has(traktId));
        }
        clearCache('trakt_watchlist');
      }

      btn.disabled = false;
    });

    const posterLink = card.querySelector('.film-poster-link');
    if (posterLink) {
      posterLink.style.position = 'relative';
      posterLink.appendChild(btn);
    }
  }
}

// ── Helpers ──

/**
 * @param {HTMLButtonElement} btn
 * @param {boolean} isOnWatchlist
 */
function updateBookmark(btn, isOnWatchlist) {
  btn.innerHTML = isOnWatchlist
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14v20l-7-4-7 4V2z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 2h14v20l-7-4-7 4V2z"/></svg>';
  btn.classList.toggle('watchlist-btn-active', isOnWatchlist);
}

/**
 * @param {string} path
 * @param {RequestInit} [opts]
 */
function traktFetch(path, opts = {}) {
  return traktShield.fetch(`${TRAKT_API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-key': meta.clientId,
      'trakt-api-version': '2',
      'Authorization': `Bearer ${accessToken}`,
      ...opts.headers,
    },
  });
}

/**
 * @param {string} cacheKey
 * @param {string} path
 */
async function cachedFetch(cacheKey, path) {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.fetchedAt < CACHE_TTL_MS) {
      return parsed.data;
    }
  }
  try {
    const res = await traktFetch(path);
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem(cacheKey, JSON.stringify({ data, fetchedAt: Date.now() }));
    return data;
  } catch {
    return null;
  }
}

/** @param {string} cacheKey */
function clearCache(cacheKey) {
  localStorage.removeItem(cacheKey);
}
