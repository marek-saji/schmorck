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
  directors?: string[];
  writers?: string[];
  cast?: string[];
  rating?: string;
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
  soldoutStatus?: 0 | 1 | 2;
  attributes?: string[];
}

interface ScheduleData {
  cinemas: Cinema[];
  films: Film[];
  screenings: Screening[];
}

export type { Cinema, Film, Screening, ScheduleData };
