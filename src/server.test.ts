import { describe, it, mock, after } from 'node:test';
import assert from 'node:assert/strict';

// Vista OData fixtures (raw API shapes)
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

// Mock env vars before importing server
mock.module('./lib/env.ts', {
  namedExports: {
    YORCK_VISTA_API_KEY: 'test-key',
    YORCK_VISTA_API_URL: 'https://vista-yorck.test/',
    PORT: 0,
    APP_URL: 'http://yorck.test',
  },
});

// Mock global.fetch to return Vista OData responses
const originalFetch = globalThis.fetch;
mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('OData.svc/Cinemas')) return Response.json(vistaFixtures.cinemas);
  if (url.includes('OData.svc/ScheduledFilms')) return Response.json(vistaFixtures.films);
  if (url.includes('OData.svc/Sessions')) return Response.json(vistaFixtures.sessions);
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
