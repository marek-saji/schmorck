/**
 * Types generated from Vista Connect swagger file.
 * @see docs/vista-connect-5.0.15.26-3295d4347650a17d899a90c01d0c16beb19fe2cd-V1.swagger.json
 */

// ── OData response wrapper ──

export interface VistaODataResponse<T> {
  value: Array<T>;
}

// ── OData.svc/Cinemas ──

export interface VistaCinema {
  ID: string;
  CinemaNationalId?: string;
  Name: string;
  NameAlt?: string;
  PhoneNumber?: string;
  EmailAddress?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  Latitude?: number;
  Longitude?: number;
  ParkingInfo?: string;
  LoyaltyCode?: string;
  IsGiftStore?: boolean;
  Description?: string;
  DescriptionAlt?: string;
  PublicTransport?: string;
  CurrencyCode?: string;
  AllowPrintAtHomeBookings?: boolean;
  AllowOnlineVoucherValidation?: boolean;
  DisplaySofaSeats?: boolean;
  TimeZoneId?: string;
  HOPK?: string;
  TipsCompulsory?: boolean;
  /** Delimited by comma in invariant decimal format (e.g. 1.23,2.154) */
  TipPercentages?: string;
  /** The name of the Cinema web server and VSS host */
  ServerName?: string;
  IsInTouchEnabled?: boolean;
  IsGetHelpEnabled?: boolean;
  /** Primary data language (e.g. Film title, synopsis) for cinema */
  PrimaryDataLanguage?: string;
  AlternateDataLanguage1?: string;
  AlternateDataLanguage2?: string;
  AlternateDataLanguage3?: string;
  HasConcessions?: boolean;
  ScheduledFilms?: Array<VistaScheduledFilm>;
  ScreenAttributes?: Array<VistaAttribute>;
  /** Concepts (Experiences) at this Cinema */
  ConceptAttributes?: Array<VistaAttribute>;
  CinemaOperators?: Array<VistaCinemaOperator>;
  NameTranslations?: Array<VistaTranslation>;
  DescriptionTranslations?: Array<VistaTranslation>;
  ParkingInfoTranslations?: Array<VistaTranslation>;
  PublicTransportTranslations?: Array<VistaTranslation>;
}

// ── OData.svc/Films ──

export interface VistaFilm {
  ID: string;
  ShortCode?: string;
  Title: string;
  TitleAlt?: string;
  Rating?: string;
  RatingAlt?: string;
  RatingDescription?: string;
  RatingDescriptionAlt?: string;
  Synopsis?: string;
  SynopsisAlt?: string;
  ShortSynopsis?: string;
  ShortSynopsisAlt?: string;
  HOFilmCode?: string;
  CorporateFilmId?: string;
  RunTime?: string;
  /** Date-time string */
  OpeningDate?: string;
  GraphicUrl?: string;
  FilmNameUrl?: string;
  TrailerUrl?: string;
  AdditionalUrls?: Array<VistaAdditionalUrl>;
  IsComingSoon?: boolean;
  IsScheduledAtCinema?: boolean;
  WebsiteUrl?: string;
  GenreId?: string;
  GenreId2?: string;
  GenreId3?: string;
  EDICode?: string;
  FormatCodes?: Array<string>;
  TwitterTag?: string;
  FilmWebId?: string;
  MovieXchangeCode?: string;
  DistributorName?: string;
  GovernmentCode?: string;
  CustomerRatingStatistics?: VistaCustomerRatingStatistics;
  CustomerRatingTrailerStatistics?: VistaCustomerRatingStatistics;
  TitleTranslations?: Array<VistaTranslation>;
  SynopsisTranslations?: Array<VistaTranslation>;
  ShortSynopsisTranslations?: Array<VistaTranslation>;
  RatingDescriptionTranslations?: Array<VistaTranslation>;
}

// ── OData.svc/ScheduledFilms ──

export interface VistaScheduledFilm {
  ID: string;
  ScheduledFilmId: string;
  CinemaId: string;
  Title: string;
  TitleAlt?: string;
  Distributor?: string;
  Rating?: string;
  RatingAlt?: string;
  RatingDescription?: string;
  RatingDescriptionAlt?: string;
  Synopsis?: string;
  SynopsisAlt?: string;
  /** Date-time string */
  OpeningDate?: string;
  FilmHOPK?: string;
  FilmHOCode?: string;
  ShortCode?: string;
  RunTime?: string;
  TrailerUrl?: string;
  /** Cast and crew including Actors, Directors and Producers */
  Cast?: Array<VistaFilmPerson>;
  DisplaySequence?: number;
  TwitterTag?: string;
  HasSessionsAvailable?: boolean;
  GraphicUrl?: string;
  CinemaName?: string;
  CinemaNameAlt?: string;
  AllowTicketSales?: boolean;
  AdvertiseAdvanceBookingDate?: boolean;
  /** Date-time string */
  AdvanceBookingDate?: string;
  /** Date-time string (with cinema time zone offset) */
  AdvanceBookingDateOffset?: string;
  /** Date-time string */
  LoyaltyAdvanceBookingDate?: string;
  /** Date-time string (with cinema time zone offset) */
  LoyaltyAdvanceBookingDateOffset?: string;
  HasDynamicallyPricedTicketsAvailable?: boolean;
  IsPlayThroughMarketingFilm?: boolean;
  PlayThroughFilms?: Array<VistaScheduledFilm>;
  CustomerRatingStatistics?: VistaCustomerRatingStatistics;
  CustomerRatingTrailerStatistics?: VistaCustomerRatingStatistics;
  /** Date-time string */
  NationalOpeningDate?: string;
  GenreId?: string;
  GenreId2?: string;
  GenreId3?: string;
  CorporateFilmId?: string;
  EDICode?: string;
  GovernmentCode?: string;
  Sessions?: Array<VistaSession>;
  FirstDaysSessions?: Array<VistaSession>;
  FutureSessions?: Array<VistaSession>;
  HasFutureSessions?: boolean;
}

// ── OData.svc/Sessions ──

export interface VistaSession {
  ID: string;
  CinemaId: string;
  ScheduledFilmId: string;
  SessionId: string;
  AreaCategoryCodes?: Array<string>;
  MinimumTicketPriceInCents?: number;
  /** Local time of session (in timezone of cinema location) */
  Showtime: string;
  IsAllocatedSeating?: boolean;
  AllowChildAdmits?: boolean;
  SeatsAvailable?: number;
  AllowComplimentaryTickets?: boolean;
  /** @deprecated Use GlobalEventId instead */
  EventId?: string;
  GlobalEventId?: string;
  PriceGroupCode?: string;
  ScreenName?: string;
  ScreenNameAlt?: string;
  ScreenNumber?: number;
  CinemaOperatorCode?: string;
  FormatCode?: string;
  FormatHOPK?: string;
  SalesChannels?: string;
  Attributes?: Array<VistaAttribute>;
  /** Attribute Short Names for session advertising */
  SessionAttributesNames?: Array<string>;
  /** Attribute Short Names for concepts/experiences */
  ConceptAttributesNames?: Array<string>;
  AllowTicketSales?: boolean;
  HasDynamicallyPricedTicketsAvailable?: boolean;
  PlayThroughId?: string;
  /** Date-time string */
  SessionBusinessDate?: string;
  SessionDisplayPriority?: number;
  GroupSessionsByAttribute?: boolean;
  /** 0=None, 1=AlmostFull, 2=Full */
  SoldoutStatus?: 0 | 1 | 2;
  TypeCode?: string;
  IsPublicScreening?: boolean;
  /** 0=Open, 1=Closed, 2=Inactive, 3=Imported, 4=Planned, 5=Unavailable, 6=Approved, 7=Cancelled, 8=Unknown */
  Status?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

// ── Shared/nested types ──

interface VistaFilmPerson {
  ID?: string;
  FirstName?: string;
  LastName?: string;
  UrlToDetails?: string;
  UrlToPicture?: string;
  PersonType?: string;
}

interface VistaAttribute {
  ID?: string;
  Description?: string;
  ShortName?: string;
  AltDescription?: string;
  AltShortName?: string;
  MessageCode?: number;
  MessageLocation?: number;
  IsUsedForConc498?: boolean;
  IsUsedForSessionAdvertising?: boolean;
  DisplayPriority?: number;
}

interface VistaCinemaOperator {
  ID?: string;
  Code?: string;
  Name?: string;
  ShortName?: string;
}

interface VistaTranslation {
  LanguageTag?: string;
  Text?: string;
}

interface VistaAdditionalUrl {
  Name?: string;
  Url?: string;
}

interface VistaCustomerRatingStatistics {
  RatingCount?: number;
  AverageScore?: number;
}
