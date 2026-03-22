import { TRAKT_CLIENT_ID } from './lib/env.ts';
import type { Storage } from './lib/storage.ts';
import type { TraktSearchResult, TraktMovie, TraktPeople } from './types/api/trakt.ts';
import type { Film } from './types.ts';

const TRAKT_API_BASE = 'https://api.trakt.tv';

const TRAKT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'trakt-api-key': TRAKT_CLIENT_ID,
  'trakt-api-version': '2',
};

const STORAGE_KEY_PREFIX = 'trakt-';

let rateLimitRemaining = 1_000;

async function traktFetch<T>(path: string): Promise<T> {
  if (rateLimitRemaining <= 1) {
    console.warn('Trakt rate limit nearly exhausted, pausing 60s');
    await new Promise(r => setTimeout(r, 60_000));
  }

  const res = await fetch(`${TRAKT_API_BASE}${path}`, { headers: TRAKT_HEADERS });

  const rateLimit = res.headers.get('X-Ratelimit');
  if (rateLimit) {
    try {
      const parsed = JSON.parse(rateLimit);
      rateLimitRemaining = parsed.remaining ?? rateLimitRemaining;
    } catch { /* ignore */ }
  }

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
    console.warn(`Trakt rate limited, retrying after ${retryAfter}s`);
    await new Promise(r => setTimeout(r, retryAfter * 1_000));
    return traktFetch(path);
  }

  if (!res.ok) {
    throw new Error(`Trakt API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function searchMovie(title: string, year?: number): Promise<TraktSearchResult | null> {
  const params = new URLSearchParams({ query: title, fields: 'title' });
  if (year) params.set('years', String(year));
  const results = await traktFetch<Array<TraktSearchResult>>(`/search/movie?${params}`);
  return results.find(result => {
    return year == null || Math.abs(result.movie.year - year) <= 2;
  }) ?? results[0]
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
    const result = await searchMovie(film.title, film.releaseYear);
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
    releaseYear: film.releaseYear ?? movie.year,
  };
}

export { lookupFilm };
export type { StoredTraktData };
