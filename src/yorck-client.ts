import type { Cinema, Film, Screening, ScheduleData } from './types.ts';
import { YORCK_VISTA_API_URL, YORCK_VISTA_API_KEY } from './lib/env.ts';
import { slugify } from './lib/slug.ts';

interface VistaFilmPerson {
  FirstName?: string;
  LastName?: string;
  PersonType?: string;
}

interface VistaCinema {
  ID: string;
  Name: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  Latitude?: number;
  Longitude?: number;
}

interface VistaScheduledFilm {
  ScheduledFilmId: string;
  Title: string;
  Synopsis?: string;
  RunTime?: string;
  Cast?: VistaFilmPerson[];
  Rating?: string;
  OpeningDate?: string;
  TrailerUrl?: string;
  GraphicUrl?: string;
}

interface VistaSession {
  SessionId: string;
  ScheduledFilmId: string;
  CinemaId: string;
  Showtime: string;
  ScreenName?: string;
  ScreenNumber?: number;
  SeatsAvailable?: number;
  SoldoutStatus?: number;
  SessionAttributesNames?: string[];
}

interface VistaODataResponse<T> {
  value: T[];
}

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

  const filmsById = new Map<string, Film>();
  for (const f of raw.films) {
    if (!filmsById.has(f.ScheduledFilmId)) {
      filmsById.set(f.ScheduledFilmId, {
        id: f.ScheduledFilmId,
        slug: slugify(f.Title),
        title: f.Title,
        posterUrl: f.GraphicUrl || `/films/${slugify(f.Title)}/poster`,
        synopsis: f.Synopsis,
        runTime: f.RunTime,
        directors: f.Cast?.filter(p => p.PersonType === 'Director').map(p => `${p.FirstName} ${p.LastName}`.trim()),
        writers: f.Cast?.filter(p => p.PersonType === 'Writer').map(p => `${p.FirstName} ${p.LastName}`.trim()),
        cast: f.Cast?.filter(p => p.PersonType === 'Actor').map(p => `${p.FirstName} ${p.LastName}`.trim()),
        rating: f.Rating,
        openingDate: f.OpeningDate,
        trailerUrl: f.TrailerUrl,
      });
    }
  }
  const films = [...filmsById.values()];

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

  return { cinemas, films, screenings };
}

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
