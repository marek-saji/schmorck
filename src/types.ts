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
  title: string;
  synopsis?: string;
  runTime?: string;
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
  soldoutStatus?: number;
  attributes?: string[];
}

interface ScheduleData {
  cinemas: Cinema[];
  films: Film[];
  screenings: Screening[];
}

export type { Cinema, Film, Screening, ScheduleData };
