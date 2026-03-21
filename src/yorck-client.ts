import type { Cinema, Film, Screening, ScheduleData } from './types.ts';
import { YORCK_VISTA_API_URL, YORCK_VISTA_API_KEY } from './lib/env.ts';

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

  return { cinemas, films, screenings };
}

const API_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'ConnectApiToken': YORCK_VISTA_API_KEY,
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(new URL(path, YORCK_VISTA_API_URL), { headers: API_HEADERS });
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
