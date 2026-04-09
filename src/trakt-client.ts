import { TRAKT_CLIENT_ID, TRAKT_CLIENT_SECRET } from './lib/env.ts';
import { createApiShield } from './lib/apiShield.ts';
import type { Storage } from './lib/storage.ts';
import type { TraktSearchResult, TraktMovie, TraktPeople, TraktOAuthTokenResult } from './types/api/trakt.ts';
import type { Film } from './types.ts';
import pkg from '../package.json' with { type: 'json' };

const TRAKT_API_BASE = 'https://api.trakt.tv';

const TRAKT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'trakt-api-key': TRAKT_CLIENT_ID,
  'trakt-api-version': '2',
  'User-Agent': `${pkg.name}/${pkg.version}`,
};

// https://trakt.docs.apiary.io/#introduction/required-headers
// GET: 1000 req / 5 min, mutations: 1 req / sec
// Halved because server and client may share the same IP.
const traktShield = createApiShield({
  rateLimitReqPerMin: 100,
  rateLimitMutatePerMin: 30,
});

const STORAGE_KEY_PREFIX = 'trakt-';

async function traktFetch<T>(
  path: string,
  { body }: { body?: object } = {}
): Promise<T> {
  const method = body ? 'POST' : 'GET'

  const res = await traktShield.fetch(
    new URL(path, TRAKT_API_BASE),
    {
      method,
      headers: TRAKT_HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  if (!res.ok) {
    let cause = await res.text();
    if (typeof cause === 'string') {
      try { cause = JSON.parse(cause) }
      catch {}
    }
    throw new Error(`Trakt API error: ${res.status} ${res.statusText}`, { cause });
  }
  return res.json() as Promise<T>;
}

async function oAuthTokenExchange(
  { origin, code }: { origin: string, code: string }
): Promise<TraktOAuthTokenResult> {
  return await traktFetch<TraktOAuthTokenResult>('/oauth/token', {
    body: ({
      code,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: new URL('/auth/trakt/callback', origin),
      grant_type: 'authorization_code',
    }),
  });
}

async function searchMovie(title: string, year: number): Promise<TraktSearchResult | null> {
  const params = new URLSearchParams({ query: title, fields: 'title' });
  if (year) params.set('years', String(year));
  const results = await traktFetch<Array<TraktSearchResult>>(`/search/movie?${params}`);
  return results.find(result => {
    return year == null || Math.abs(result.movie.year - year) <= 2;
  }) ?? null
}

async function getMovieDetails(id: number): Promise<TraktMovie> {
  return traktFetch<TraktMovie>(`/movies/${id}?extended=full`);
}

async function getMoviePeople(id: number): Promise<TraktPeople> {
  return traktFetch<TraktPeople>(`/movies/${id}/people`);
}

interface StoredTraktDataFull {
  movie: TraktMovie;
  people: TraktPeople;
  fetchedAt: string;
}

interface StoredTraktDataEmpty {
  movie: null;
  fetchedAt: string;
}

type StoredTraktData = StoredTraktDataFull | StoredTraktDataEmpty;

async function lookupFilm(film: Film, storage: Storage): Promise<Film> {
  const releaseYear = film.releaseYear;

  if (!releaseYear) {
    return film;
  }

  // Check storage first
  const stored = await storage.get<StoredTraktData>(
    STORAGE_KEY_PREFIX + film.id
  );
  if (stored) {
    if (stored.movie === null) {
      return film
    } else {
      return enrichFilm(film, stored.movie, stored.people);
    }
  }

  // Search on Trakt
  try {
    const normalizedTitle = film.title.replace(/[",']/g, '').trim();
    const result = await searchMovie(normalizedTitle, releaseYear);
    const fetchedAt = new Date().toISOString();

    if (!result) {
      await storage.set(STORAGE_KEY_PREFIX + film.id, {
        movie: null,
        fetchedAt,
      });
      console.log(`Trakt: no match for "${film.title} (${film.releaseYear}) [${film.id}]"`);
      return film;
    }

    const [movie, people] = await Promise.all([
      getMovieDetails(result.movie.ids.trakt),
      getMoviePeople(result.movie.ids.trakt),
    ]);

    await storage.set(STORAGE_KEY_PREFIX + film.id, {
      movie,
      people,
      fetchedAt,
    } satisfies StoredTraktData);

    console.log(`Trakt: matched "${film.title}" (${film.releaseYear}) [${film.id}] → "${movie.title}" (${movie.year}) [${movie.ids.trakt}]`);
    return enrichFilm(film, movie, people);
  } catch (err) {
    console.error(`Trakt: failed to look up "${film.title}" (${film.releaseYear}) [${film.id}]:`, err);
    return film;
  }
}

function enrichFilm(film: Film, movie: TraktMovie, people: TraktPeople): Film {
  const directors = people.crew?.directing?.map(c => c.person.name);
  const writers = people.crew?.writing?.map(c => c.person.name);
  const cast = people.cast?.map(c => c.person.name);

  return {
    ...film,
    traktId: movie.ids.trakt,
    traktSlug: movie.ids.slug,
    originalTitle: film.originalTitle ?? (movie.title !== film.title ? movie.title : undefined),
    synopsis: film.synopsis || movie.overview,
    directors: film.directors?.length ? film.directors : (directors?.length ? directors : undefined),
    writers: film.writers?.length ? film.writers : (writers?.length ? writers : undefined),
    cast: film.cast?.length ? film.cast : (cast?.length ? cast : undefined),
    // We pick Trakt.tv year over the Yorck one, because Yorck sometimes
    // includes incorrect year for re–releases
    releaseYear: movie.year ?? film.releaseYear,
  };
}

export { lookupFilm, oAuthTokenExchange as traktOAuthTokenExchange };
export type { StoredTraktData };
