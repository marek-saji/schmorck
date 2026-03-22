/**
 * Types for Yorck mobile API responses.
 * @see docs/api-exploration.md
 */

// ── api/mobile/v1/app-launch-data ──

export interface YorckAppLaunchData {
  cinemas: Array<YorckCinema>;
  siteGroups: Array<YorckSiteGroup>;
  regions: Array<unknown>;
  settings: unknown;
  bookingTipsConfiguration: unknown;
  customerRatingTypes: unknown;
  loyaltySettings: unknown;
}

export interface YorckCinema {
  id: string;
  name: string;
  nameAlt: string | null;
  cinemaNationalId: string;
  phoneNumber: string;
  emailAddress: string;
  address1: string;
  address2: string;
  city: string;
  latitude: number;
  longitude: number;
  parkingInfo: string;
  publicTransport: string;
  description: string;
  descriptionAlt: string | null;
  currencyCode: string;
  timeZoneId: string;
  hopk: string;
  loyaltyCode: string;
  serverName: string;
  primaryDataLanguage: string | null;
  alternateDataLanguage1: string | null;
  alternateDataLanguage2: string | null;
  alternateDataLanguage3: string | null;
  isGiftStore: boolean;
  allowPrintAtHomeBookings: boolean;
  allowOnlineVoucherValidation: boolean;
  displaySofaSeats: boolean;
  tipsCompulsory: boolean;
  tipPercentages: string;
  isInTouchEnabled: boolean;
  isGetHelpEnabled: boolean;
  hasConcessions: boolean;
  filmTerritoryCode: string;
  regionId: string | null;
  regionCode: string | null;
  cinemaOperators: Array<YorckCinemaOperator>;
  scheduledFilms: Array<unknown>;
  screenAttributes: Array<unknown>;
  conceptAttributes: Array<unknown>;
  nameTranslations: Array<unknown>;
  descriptionTranslations: Array<unknown>;
  parkingInfoTranslations: Array<unknown>;
  publicTransportTranslations: Array<unknown>;
}

interface YorckCinemaOperator {
  id: string;
  cinemaId: string;
  code: string;
  name: string;
  shortName: string;
  hoOperatorCode: string;
  isDefault: boolean;
  hasDeliveryConcessions: boolean;
  hasPickupConcessions: boolean;
  groups: Array<unknown>;
}

interface YorckSiteGroup {
  id: string;
  name: string;
  areaCode: string;
  clientId: string | null;
  isOnlyAvailableToClient: boolean;
  cinemaIds: Array<string>;
  regionId: string | null;
  regionCode: string | null;
}

// ── api/mobile/v1/films ──

export interface YorckFilm {
  id: string;
  hoCode: string;
  hopk: string;
  title: string;
  rating: string;
  ratingDescription: string;
  /** Runtime in minutes (number, unlike Vista OData which is string) */
  runTime: number;
  /** Date-time string */
  openingDate: string;
  /** Date-time string, or null */
  advanceBookingDate: string | null;
  genreName: string;
  customerRating: YorckCustomerRating;
  customerTrailerRating: YorckCustomerTrailerRating;
  directors: Array<string>;
  actors: Array<string>;
  synopsis: string;
  trailerUrl: string;
  twitterTag: string;
  websiteUrl: string;
  displaySequence: number;
  cinemaAttributeLinks: Array<YorckCinemaAttributeLink>;
  cinemaIds: Array<string>;
  filmTerritoryCode: string | null;
  movieXchangeMasterCode: string | null;
  regionId: string | null;
  regionCode: string | null;
}

interface YorckCustomerRating {
  count: number;
  value: number;
}

interface YorckCustomerTrailerRating {
  views: number;
  likes: number;
}

interface YorckCinemaAttributeLink {
  cinemaId: string;
  attributeShortNames: Array<string>;
}

// ── api/mobile/v1/sessions ──

export interface YorckSession {
  sessionId: string;
  cinemaId: string;
  cinemaOperatorCode: string;
  filmId: string;
  /** Date-time string (local time) */
  showtime: string;
  /** Date-time string (local time) */
  endTime: string;
  screenName: string;
  screenNumber: number;
  isAllocatedSeating: boolean;
  allowChildAdmits: boolean;
  seatsAvailable: number;
  /** 0=None, 1=AlmostFull, 2=Full */
  soldoutStatus: 0 | 1 | 2;
  trailerDuration: number;
  attributeShortNames: Array<string>;
  hasDeliverableArea: boolean;
  deliveryEndTime: string | null;
  inSeatDeliveryFee: unknown | null;
}
