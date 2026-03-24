import { describe, it, mock, after } from 'node:test';
import assert from 'node:assert/strict';

// Vista OData fixtures
const vistaFixtures = {
  cinemas: { value: [{ ID: '0000000001', Name: 'Delphi LUX', Address1: 'Kantstraße 10', City: 'Berlin', Latitude: 52.505, Longitude: 13.325 }] },
  films: { value: [{
    ScheduledFilmId: 'HO00004842', Title: 'Anora', Synopsis: 'A young woman from Brooklyn...',
    RunTime: '139', Rating: 'FSK 16', TrailerUrl: 'https://www.youtube.com/watch?v=abc',
    Cast: [
      { FirstName: 'Mikey', LastName: 'Madison', PersonType: 'Actor' },
      { FirstName: 'Mark', LastName: 'Eydelshteyn', PersonType: 'Actor' },
    ],
  }] },
  sessions: { value: [{
    SessionId: 'sess-1', ScheduledFilmId: 'HO00004842', CinemaId: '0000000001',
    Showtime: new Date(Date.now() + 3_600_000).toISOString(),
    ScreenName: 'Saal 1', ScreenNumber: 1, SeatsAvailable: 42, SoldoutStatus: 0,
    SessionAttributesNames: ['OmU'],
  }] },
};

// Yorck mobile API fixtures
const yorckFixtures = {
  appLaunchData: {
    cinemas: [{
      id: '1001', name: 'Delphi LUX', nameAlt: '', cinemaNationalId: '',
      phoneNumber: '', emailAddress: '', address1: 'Kantstraße 10', address2: '',
      city: 'Berlin', latitude: 52.505, longitude: 13.325,
      parkingInfo: '', publicTransport: '', description: '', descriptionAlt: null,
      currencyCode: 'EUR', timeZoneId: '', hopk: '', loyaltyCode: '', serverName: '',
      primaryDataLanguage: null, alternateDataLanguage1: null, alternateDataLanguage2: null, alternateDataLanguage3: null,
      isGiftStore: false, allowPrintAtHomeBookings: false, allowOnlineVoucherValidation: false,
      displaySofaSeats: false, tipsCompulsory: false, tipPercentages: '',
      isInTouchEnabled: false, isGetHelpEnabled: false, hasConcessions: false,
      filmTerritoryCode: '', regionId: null, regionCode: null,
      cinemaOperators: [], scheduledFilms: [], screenAttributes: [], conceptAttributes: [],
      nameTranslations: [], descriptionTranslations: [], parkingInfoTranslations: [], publicTransportTranslations: [],
    }],
    siteGroups: [], regions: [], settings: null, bookingTipsConfiguration: null, customerRatingTypes: null, loyaltySettings: null,
  },
  films: [{
    id: 'HO00004842', hoCode: '', hopk: '', title: 'Anora',
    rating: 'FSK 16', ratingDescription: '', runTime: 139,
    openingDate: '2024-11-28T00:00:00', advanceBookingDate: null,
    genreName: 'Spielfilm',
    customerRating: { count: 0, value: 0 }, customerTrailerRating: { views: 0, likes: 0 },
    directors: ['Sean Baker'], actors: ['Mikey Madison', 'Mark Eydelshteyn'],
    synopsis: 'A young woman from Brooklyn...',
    trailerUrl: 'https://www.youtube.com/watch?v=abc',
    twitterTag: '', websiteUrl: '', displaySequence: 0,
    cinemaAttributeLinks: [], cinemaIds: ['1001'],
    filmTerritoryCode: null, movieXchangeMasterCode: null, regionId: null, regionCode: null,
  }],
  sessions: [{
    sessionId: 'sess-1', cinemaId: '1001', cinemaOperatorCode: '1001',
    filmId: 'HO00004842',
    showtime: new Date(Date.now() + 3_600_000).toISOString(),
    endTime: new Date(Date.now() + 2 * 3_600_000).toISOString(),
    screenName: 'Saal 1', screenNumber: 1, seatsAvailable: 42, soldoutStatus: 0 as const,
    isAllocatedSeating: true, allowChildAdmits: true, trailerDuration: 0,
    attributeShortNames: ['OmU'],
    hasDeliverableArea: false, deliveryEndTime: null, inSeatDeliveryFee: null,
  }],
};

// Mock env vars before importing server
mock.module('./lib/env.ts', {
  namedExports: {
    YORCK_VISTA_API_KEY: 'test-key',
    YORCK_VISTA_API_URL: 'https://vista-yorck.test/',
    TRAKT_CLIENT_ID: 'test-trakt-id',
    TRAKT_CLIENT_SECRET: undefined,
    APP_URL: 'http://yorck.test:0',
    NODE_ENV: 'test',
    COMMIT_SHA: undefined,
  },
});

// Mock global.fetch to return API responses
const originalFetch = globalThis.fetch;
mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
  const url = String(input);
  // Vista OData
  if (url.includes('OData.svc/Cinemas')) return Response.json(vistaFixtures.cinemas);
  if (url.includes('OData.svc/ScheduledFilms')) return Response.json(vistaFixtures.films);
  if (url.includes('OData.svc/Films')) return Response.json(vistaFixtures.films);
  if (url.includes('OData.svc/Sessions')) return Response.json(vistaFixtures.sessions);
  // Yorck mobile
  if (url.includes('api/mobile/v1/app-launch-data')) return Response.json(yorckFixtures.appLaunchData);
  if (url.includes('api/mobile/v1/films')) return Response.json(yorckFixtures.films);
  if (url.includes('api/mobile/v1/sessions')) return Response.json(yorckFixtures.sessions);
  // Poster CDN
  if (url.includes('/CDN/media/entity/get/Movies/')) return new Response('Not found', { status: 404 });
  return new Response('Not found', { status: 404 });
});

const { server } = await import('./server.ts');

// Wait for server to be listening and get the assigned port
const baseUrl = await new Promise<string>(resolve => {
  const addr = server.address();
  if (typeof addr === 'object' && addr) {
    resolve(`http://localhost:${addr.port}`);
    return;
  }
  server.on('listening', () => {
    const addr = server.address();
    if (typeof addr === 'object' && addr) resolve(`http://localhost:${addr.port}`);
  });
});

after(() => {
  server.close();
});

describe('Integration', () => {
  it('GET / renders home page with films', async () => {
    const res = await originalFetch(baseUrl);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Delphi LUX'));
    assert.ok(html.includes('OmU'));
    assert.ok(html.includes('/films/anora'));
  });

  it('GET /films/:slug renders film detail', async () => {
    const res = await originalFetch(`${baseUrl}/films/anora`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Anora'));
    assert.ok(html.includes('Mikey Madison'));
    assert.ok(html.includes('139 min'));
    assert.ok(html.includes('OmU'));
  });

  it('GET /films/:id returns 404 for unknown film', async () => {
    const res = await originalFetch(`${baseUrl}/films/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('GET /unknown returns 404', async () => {
    const res = await originalFetch(`${baseUrl}/unknown`);
    assert.equal(res.status, 404);
  });
});
