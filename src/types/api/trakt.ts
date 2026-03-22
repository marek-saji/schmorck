/**
 * Types for Trakt.tv API responses.
 * @see https://trakt.docs.apiary.io/
 */

export interface TraktIds {
  trakt: number;
  slug: string;
  imdb?: string;
  tmdb?: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
  overview?: string;
  released?: string;
  runtime?: number;
  status?: string;
}

export interface TraktSearchResult {
  score: number;
  movie: TraktMovie;
}

export interface TraktPerson {
  name: string;
  ids: TraktIds;
}

export interface TraktCastMember {
  characters: Array<string>;
  person: TraktPerson;
}

export interface TraktCrewMember {
  jobs: Array<string>;
  person: TraktPerson;
}

export interface TraktPeople {
  cast: Array<TraktCastMember>;
  crew: {
    directing?: Array<TraktCrewMember>;
    writing?: Array<TraktCrewMember>;
    [key: string]: Array<TraktCrewMember> | undefined;
  };
}
