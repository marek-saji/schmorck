import type { Cinema, Film, Screening, ScheduleData } from './types.ts';
import type { VistaCinema, VistaFilm, VistaScheduledFilm, VistaSession, VistaODataResponse } from './types/api/vista.ts';
import type { YorckAppLaunchData, YorckCinema, YorckFilm, YorckSession } from './types/api/yorck.ts';
import { YORCK_VISTA_API_URL, YORCK_VISTA_API_KEY } from './lib/env.ts';
import { slugify } from './lib/slug.ts';

// ── Cinema mappers ──

function mapVistaCinema(c: VistaCinema): Cinema {
  return {
    id: c.ID,
    name: c.Name,
    address: [c.Address1, c.Address2].filter(Boolean).join(', ') || undefined,
    city: c.City,
    latitude: c.Latitude,
    longitude: c.Longitude,
  };
}

function mapYorckCinema(c: YorckCinema): Cinema {
  return {
    id: c.id,
    name: c.name,
    address: [c.address1, c.address2].filter(Boolean).join(', ') || undefined,
    city: c.city || undefined,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

function mapCinema(c: VistaCinema | YorckCinema): Cinema {
  return 'ID' in c ? mapVistaCinema(c) : mapYorckCinema(c);
}

// ── Film mappers ──

function mapVistaFilm(f: VistaFilm | VistaScheduledFilm): Film {
  const id = 'ScheduledFilmId' in f ? f.ScheduledFilmId : f.ID;
  const slug = slugify(f.Title);
  return {
    id,
    slug,
    title: f.Title,
    posterUrl: f.GraphicUrl || `/films/${slug}/poster`,
    synopsis: f.Synopsis,
    runTime: f.RunTime,
    directors: 'Cast' in f ? f.Cast?.filter(p => p.PersonType === 'Director').map(p => `${p.FirstName} ${p.LastName}`.trim()) : undefined,
    writers: 'Cast' in f ? f.Cast?.filter(p => p.PersonType === 'Writer').map(p => `${p.FirstName} ${p.LastName}`.trim()) : undefined,
    cast: 'Cast' in f ? f.Cast?.filter(p => p.PersonType === 'Actor').map(p => `${p.FirstName} ${p.LastName}`.trim()) : undefined,
    rating: f.Rating,
    openingDate: f.OpeningDate,
    trailerUrl: f.TrailerUrl,
  };
}

function mapYorckFilm(f: YorckFilm): Film {
  return {
    id: f.id,
    slug: slugify(f.title),
    title: f.title,
    posterUrl: `/films/${slugify(f.title)}/poster`,
    synopsis: f.synopsis || undefined,
    runTime: f.runTime ? String(f.runTime) : undefined,
    directors: f.directors.length ? f.directors : undefined,
    writers: undefined,
    cast: f.actors.length ? f.actors : undefined,
    rating: f.rating || undefined,
    openingDate: f.openingDate,
    trailerUrl: f.trailerUrl || undefined,
  };
}

function mapFilm(f: VistaFilm | VistaScheduledFilm | YorckFilm): Film {
  if ('Title' in f) return mapVistaFilm(f);
  return mapYorckFilm(f);
}

// ── Session mappers ──

const SOLDOUT_MAP = ['no', 'almost', 'yes'] as const;

function mapVistaSession(s: VistaSession): Screening {
  return {
    id: s.SessionId,
    scheduledFilmId: s.ScheduledFilmId,
    cinemaId: s.CinemaId,
    showtime: new Date(s.Showtime),
    screenName: s.ScreenName,
    screenNumber: s.ScreenNumber,
    seatsAvailable: s.SeatsAvailable,
    soldout: s.SoldoutStatus != null ? SOLDOUT_MAP[s.SoldoutStatus] : undefined,
    attributes: s.SessionAttributesNames,
  };
}

function mapYorckSession(s: YorckSession): Screening {
  return {
    id: s.sessionId,
    scheduledFilmId: s.filmId,
    cinemaId: s.cinemaId,
    showtime: new Date(s.showtime),
    screenName: s.screenName,
    screenNumber: s.screenNumber,
    seatsAvailable: s.seatsAvailable,
    soldout: SOLDOUT_MAP[s.soldoutStatus],
    attributes: s.attributeShortNames,
  };
}

function mapSession(s: VistaSession | YorckSession): Screening {
  return 'SessionId' in s ? mapVistaSession(s) : mapYorckSession(s);
}

// ── Unified mapper ──

interface RawApiData {
  cinemas?: Array<VistaCinema>;
  appLaunchData?: YorckAppLaunchData;
  films: Array<VistaFilm | VistaScheduledFilm | YorckFilm>;
  sessions: Array<VistaSession | YorckSession>;
}

function rawFilmId(f: VistaFilm | VistaScheduledFilm | YorckFilm): string {
  if ('ScheduledFilmId' in f) return f.ScheduledFilmId;
  if ('ID' in f) return f.ID;
  return f.id;
}

function mapApiResponse(raw: RawApiData): ScheduleData {
  const uniqueFilms = [...(new Map<string, VistaFilm | VistaScheduledFilm | YorckFilm>(
    raw.films.map(f => [rawFilmId(f), f])
  ).values())];

  return {
    cinemas: (raw.cinemas ?? raw.appLaunchData?.cinemas ?? []).map(mapCinema),
    films: uniqueFilms.map(mapFilm),
    screenings: raw.sessions.map(mapSession),
  };
}

// ── Fetch ──

const API_HEADERS: HeadersInit = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
  'ConnectApiToken': YORCK_VISTA_API_KEY,
};

async function fetchJson<T>(path: string): Promise<T> {
  const url = new URL(path, YORCK_VISTA_API_URL);
  console.log('API', 'GET', url.toString());
  const res = await fetch(url, { headers: API_HEADERS });
  if (!res.ok) {
    throw new Error(`Yorck API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function fetchSchedule(): Promise<ScheduleData> {
  const API = 'yorck' as ('vista' | 'yorck')
  switch (API) {
    case 'vista': {
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
    case 'yorck': {
      const [appLaunchData, films, sessions] = await Promise.all([
        fetchJson<YorckAppLaunchData>('api/mobile/v1/app-launch-data'),
        fetchJson<Array<YorckFilm>>('api/mobile/v1/films'),
        fetchJson<Array<YorckSession>>('api/mobile/v1/sessions'),
      ]);
      return mapApiResponse({
        appLaunchData,
        films,
        sessions,
      });
    }
    default:
      throw new Error(`Unsupported API type: ${API}`);
  }
}

export { mapApiResponse, fetchSchedule };
export type { RawApiData };
