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
      const meRes = await traktFetch('/users/me');
      if (!meRes.ok) {
        throw new Error('Failed to fetch basic user data', { cause: meRes })
      }
      const me = await meRes.json();
      const userRes = await traktFetch(`/users/${me.username}?extended=full`);
      if (!userRes.ok) {
        throw new Error('Failed to fetch extended user data', { cause: userRes })
      }
      const user = await userRes.json();
      const avatar = user.images?.avatar?.full;
      const tpl = /** @type {HTMLTemplateElement} */ (document.getElementById('tpl-trakt-user'));
      const frag = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
      const avatarImg = frag.querySelector('img');
      if (avatar) {
        /** @type {HTMLImageElement} */ (avatarImg).src = avatar;
      } else {
        avatarImg?.remove();
      }
      /** @type {HTMLElement} */ (frag.querySelector('.trakt-username')).textContent = user.username;
      userEl.replaceChildren(frag);
    } catch (cause) {
      console.error(new Error('Failed to fetch user data', { cause }));
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
    redirect_uri: (new URL('/auth/trakt/callback', window.location.href)).toString(),
    response_type: 'code',
  })}`;
  const tpl = /** @type {HTMLTemplateElement} */ (document.getElementById('tpl-trakt-signin'));
  const frag = /** @type {DocumentFragment} */ (tpl.content.cloneNode(true));
  /** @type {HTMLAnchorElement} */ (frag.querySelector('a')).href = authorizeUrl;
  userEl.replaceChildren(frag);
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
  const actionsTpl = (/** @type {HTMLTemplateElement} */ document.getElementById('tpl-film-actions'));
  for (const card of cards) {
    const traktId = Number(card.dataset.traktId);

    // Bookmark button
    const actions = (/** @type {HTMLDivElement} */ actionsTpl.content).cloneNode(true);
    const btn = actions.querySelector('[data-action="watchlist"]')

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.getAttribute('aria-disabled') !== 'true') {
        const isOn = watchlistIds.has(traktId);
        btn.setAttribute('aria-disabled', 'true');

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
          for (const c of /** @type {NodeListOf<HTMLElement>} */ (
            document.querySelectorAll(`.film-card[data-trakt-id="${traktId}"]`)
          )) {
            const dateGroup = /** @type {HTMLElement | null} */ (c.closest('.date-group'));
            if (dateGroup) organiseBySection(dateGroup, watchlistIds, watchedIds);
          }
          clearCache('trakt_watchlist');
        }

        btn.removeAttribute('aria-disabled');
      }
    });

    card.appendChild(actions);
  }

  for (const dateGroup of /** @type {NodeListOf<HTMLElement>} */ (
    document.querySelectorAll('.date-group')
  )) {
    organiseBySection(dateGroup, watchlistIds, watchedIds);
  }
}

// ── Helpers ──

/**
 * @param {Element} parent
 * @param {Element} node
 */
function moveInto(parent, node) {
  if ('moveBefore' in parent) {
    parent.moveBefore(node, null);
  } else {
    parent.append(node);
  }
}

/**
 * @param {HTMLElement} dateGroup
 * @param {Set<number>} watchlistIds
 * @param {Set<number>} watchedIds
 */
function organiseBySection(dateGroup, watchlistIds, watchedIds) {
  const tpl = /** @type {HTMLTemplateElement} */ (document.getElementById('tpl-status-sections'));

  /** @param {HTMLElement} card */
  const stateFor = (card) => {
    const id = Number(card.dataset.traktId);
    return watchlistIds.has(id) ? 'watchlist'
      : watchedIds.has(id)      ? 'watched'
      :                           'new';
  };

  /** @param {HTMLElement} card */
  function updateActionLabels (card) {
    const id = Number(card.dataset.traktId);
    const watchlistBtn = card.querySelector('[data-action="watchlist"]');
    watchlistBtn?.setAttribute(
      'aria-label',
      watchlistIds.has(id) ? watchlistBtn?.dataset.labelAdd : watchlistBtn?.dataset.labelRemove
    );
  }

  const unknown = dateGroup.querySelector('.status-group[data-state="unknown"]');
  if (unknown) {
    unknown.after(tpl.content.cloneNode(true));
    for (const card of /** @type {Array<HTMLElement>} */ (
      Array.from(unknown.querySelectorAll('.film-card'))
    )) {
      const target = dateGroup.querySelector(`.status-group[data-state="${stateFor(card)}"]`);
      if (!target) {
        throw new Error('Failed to find a group to move a card to', { cause: card });
      }
      moveInto(target, card);
      updateActionLabels(card);
    }
    unknown.remove();
  } else {
    for (const card of /** @type {NodeListOf<HTMLElement>} */ (
      dateGroup.querySelectorAll('.film-card[data-trakt-id]')
    )) {
      const target = dateGroup.querySelector(`.status-group[data-state="${stateFor(card)}"]`);
      if (target && card.parentElement !== target) moveInto(target, card);
      updateActionLabels(card);
    }
  }
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
