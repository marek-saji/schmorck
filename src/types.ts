interface Cinema {
  id: string;
  name: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

interface Film {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  synopsis?: string;
  runTime?: string;
  directors?: Array<string>;
  writers?: Array<string>;
  cast?: Array<string>;
  rating?: string;
  releaseYear?: number;
  openingDate?: string;
  trailerUrl?: string;
}

interface Screening {
  id: string;
  scheduledFilmId: string;
  cinemaId: string;
  showtime: Date;
  screenName?: string;
  screenNumber?: number;
  seatsAvailable?: number;
  soldout?: 'no' | 'almost' | 'yes';
  attributes?: Array<string>;
}

interface ScheduleData {
  cinemas: Array<Cinema>;
  films: Array<Film>;
  screenings: Array<Screening>;
}

export type { Cinema, Film, Screening, ScheduleData };
