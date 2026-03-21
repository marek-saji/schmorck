import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';

mock.module('./lib/env.ts', {
  namedExports: {
    YORCK_VISTA_API_KEY: 'test-key',
    YORCK_VISTA_API_URL: 'https://example.com/',
  },
});

const { mapApiResponse } = await import('./yorck-client.ts');

describe('mapApiResponse', () => {
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
        ScheduledFilmId: 'HO00004842',
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
    assert.deepEqual(result.films[0].cast, ['Mikey Madison', 'Sean Baker']);
    assert.equal(raw.films[0].Title, 'Anora', 'should not mutate input');
  });

  it('maps a screening with showtime', () => {
    const raw = {
      cinemas: [],
      films: [],
      sessions: [{
        SessionId: 'sess-1',
        ScheduledFilmId: 'HO00004842',
        CinemaId: '0000000001',
        Showtime: '2026-03-20T18:30:00',
        ScreenName: 'Saal 1',
        ScreenNumber: 1,
        SeatsAvailable: 42,
        SoldoutStatus: 0,
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
