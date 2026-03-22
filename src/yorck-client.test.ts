import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('./lib/env.ts', {
  namedExports: {
    YORCK_VISTA_API_KEY: 'test-key',
    YORCK_VISTA_API_URL: 'https://vista-yorck.test/',
    TRAKT_CLIENT_ID: 'test-trakt-id',
    TRAKT_CLIENT_SECRET: undefined,
    NODE_ENV: 'test',
    COMMIT_SHA: undefined,
  },
});

const { mapApiResponse } = await import('./yorck-client.ts');

describe('mapApiResponse', () => {
  describe('Vista', () => {
    it('maps a cinema', () => {
      const raw = {
        cinemas: [{ ID: '0000000001', Name: 'Delphi LUX', Address1: 'Kantstraße 10', City: 'Berlin', Latitude: 52.505, Longitude: 13.325 }],
        films: [],
        sessions: [],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.cinemas.length, 1);
      assert.equal(result.cinemas[0].name, 'Delphi LUX');
      assert.equal(result.cinemas[0].address, 'Kantstraße 10');
      assert.equal(raw.cinemas[0].Name, 'Delphi LUX', 'should not mutate input');
    });

    it('maps a film with cast', () => {
      const raw = {
        cinemas: [],
        films: [{
          ID: 'sf-1',
          ScheduledFilmId: 'HO00004842',
          CinemaId: '0000000001',
          Title: 'Anora',
          Synopsis: 'A young woman from Brooklyn...',
          RunTime: '139',
          Rating: 'FSK 16',
          TrailerUrl: 'https://www.youtube.com/watch?v=abc',
          Cast: [
            { FirstName: 'Mikey', LastName: 'Madison', PersonType: 'Actor' },
            { FirstName: 'Sean', LastName: 'Baker', PersonType: 'Director' },
          ],
        }],
        sessions: [],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.films[0].title, 'Anora');
      assert.equal(result.films[0].slug, 'anora');
      assert.deepEqual(result.films[0].cast, ['Mikey Madison']);
      assert.deepEqual(result.films[0].directors, ['Sean Baker']);
      assert.equal(raw.films[0].Title, 'Anora', 'should not mutate input');
    });

    it('maps a session', () => {
      const raw = {
        cinemas: [],
        films: [],
        sessions: [{
          ID: 'sess-1',
          SessionId: 'sess-1',
          ScheduledFilmId: 'HO00004842',
          CinemaId: '0000000001',
          Showtime: '2026-03-20T18:30:00',
          ScreenName: 'Saal 1',
          ScreenNumber: 1,
          SeatsAvailable: 42,
          SoldoutStatus: 0 as const,
          SessionAttributesNames: ['OmU'],
        }],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.screenings[0].scheduledFilmId, 'HO00004842');
      assert.ok(result.screenings[0].showtime instanceof Date);
      assert.deepEqual(result.screenings[0].attributes, ['OmU']);
      assert.equal(raw.sessions[0].SessionId, 'sess-1', 'should not mutate input');
    });
  });

  describe('Yorck', () => {
    it('maps a cinema from appLaunchData', () => {
      const raw = {
        appLaunchData: { cinemas: [{
          id: '1001',
          name: 'Delphi Lux',
          nameAlt: '',
          cinemaNationalId: '',
          phoneNumber: '+4930322931322',
          emailAddress: '',
          address1: 'Kantstraße 10',
          address2: '10623 Berlin',
          city: '',
          latitude: 52.5056,
          longitude: 13.3295,
          parkingInfo: '',
          publicTransport: '',
          description: '',
          descriptionAlt: null,
          currencyCode: 'EUR',
          timeZoneId: 'W. Europe Standard Time',
          hopk: '1001',
          loyaltyCode: '1',
          serverName: 'CINE-LUX-CS',
          primaryDataLanguage: null,
          alternateDataLanguage1: null,
          alternateDataLanguage2: null,
          alternateDataLanguage3: null,
          isGiftStore: false,
          allowPrintAtHomeBookings: false,
          allowOnlineVoucherValidation: true,
          displaySofaSeats: false,
          tipsCompulsory: false,
          tipPercentages: '0.00,0.00,0.00,0.00',
          isInTouchEnabled: false,
          isGetHelpEnabled: false,
          hasConcessions: true,
          filmTerritoryCode: '',
          regionId: null,
          regionCode: null,
          cinemaOperators: [],
          scheduledFilms: [],
          screenAttributes: [],
          conceptAttributes: [],
          nameTranslations: [],
          descriptionTranslations: [],
          parkingInfoTranslations: [],
          publicTransportTranslations: [],
        }], siteGroups: [], regions: [], settings: null, bookingTipsConfiguration: null, customerRatingTypes: null, loyaltySettings: null },
        films: [],
        sessions: [],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.cinemas.length, 1);
      assert.equal(result.cinemas[0].name, 'Delphi Lux');
      assert.equal(result.cinemas[0].address, 'Kantstraße 10, 10623 Berlin');
      assert.equal(raw.appLaunchData.cinemas[0].name, 'Delphi Lux', 'should not mutate input');
    });

    it('maps a film with directors and actors', () => {
      const raw = {
        cinemas: [],
        films: [{
          id: 'HO00004842',
          hoCode: '0042',
          hopk: 'HO00004842',
          title: 'Anora',
          rating: 'FSK 16',
          ratingDescription: '',
          runTime: 139,
          openingDate: '2024-11-28T00:00:00',
          advanceBookingDate: null,
          genreName: 'Spielfilm',
          customerRating: { count: 10, value: 9.5 },
          customerTrailerRating: { views: 0, likes: 0 },
          directors: ['Sean Baker'],
          actors: ['Mikey Madison', 'Mark Eydelshteyn'],
          synopsis: 'A young woman from Brooklyn...',
          trailerUrl: 'https://www.youtube.com/watch?v=abc',
          twitterTag: '',
          websiteUrl: '',
          displaySequence: 10,
          cinemaAttributeLinks: [],
          cinemaIds: ['1001'],
          filmTerritoryCode: null,
          movieXchangeMasterCode: null,
          regionId: null,
          regionCode: null,
        }],
        sessions: [],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.films[0].title, 'Anora');
      assert.equal(result.films[0].slug, 'anora');
      assert.equal(result.films[0].runTime, '139');
      assert.deepEqual(result.films[0].directors, ['Sean Baker']);
      assert.deepEqual(result.films[0].cast, ['Mikey Madison', 'Mark Eydelshteyn']);
      assert.equal(raw.films[0].title, 'Anora', 'should not mutate input');
    });

    it('maps a session', () => {
      const raw = {
        cinemas: [],
        films: [],
        sessions: [{
          sessionId: 'sess-1',
          cinemaId: '1001',
          cinemaOperatorCode: '1001',
          filmId: 'HO00004842',
          showtime: '2026-03-22T18:30:00',
          endTime: '2026-03-22T20:49:00',
          screenName: 'Saal 1',
          screenNumber: 1,
          isAllocatedSeating: true,
          allowChildAdmits: true,
          seatsAvailable: 42,
          soldoutStatus: 0 as const,
          trailerDuration: 18,
          attributeShortNames: ['OmU'],
          hasDeliverableArea: false,
          deliveryEndTime: null,
          inSeatDeliveryFee: null,
        }],
      };
      const result = mapApiResponse(structuredClone(raw));
      assert.equal(result.screenings[0].scheduledFilmId, 'HO00004842');
      assert.ok(result.screenings[0].showtime instanceof Date);
      assert.deepEqual(result.screenings[0].attributes, ['OmU']);
      assert.equal(raw.sessions[0].sessionId, 'sess-1', 'should not mutate input');
    });
  });
});
