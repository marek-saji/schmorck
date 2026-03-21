import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Film, Screening, Cinema } from '../types.ts';

interface HomeOptions {
  data: ScheduleData;
  stale: boolean;
}

function homePage({ data, stale }: HomeOptions): string {
  const { films, screenings, cinemas } = data;
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  // Sort films by earliest upcoming screening
  const now = new Date();
  const filmWithEarliest = films
    .map(film => {
      const filmScreenings = screenings
        .filter(s => s.scheduledFilmId === film.id && s.showtime > now)
        .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());
      return { film, screenings: filmScreenings, earliest: filmScreenings[0]?.showtime };
    })
    .filter(f => f.earliest) // Only films with upcoming screenings
    .sort((a, b) => a.earliest!.getTime() - b.earliest!.getTime());

  const body = filmWithEarliest.length === 0
    ? '<p>No upcoming screenings.</p>'
    : filmWithEarliest.map(({ film, screenings }) =>
        filmCard(film, screenings, cinemaMap)
      ).join('\n');

  return layout({ title: 'Schedule', stale, body });
}

function filmCard(
  film: Film,
  screenings: Screening[],
  cinemaMap: Map<string, Cinema>,
): string {
  const poster = `<img src="/posters/${escapeHtml(film.id)}" alt="" class="film-poster" style="view-transition-name: poster-${escapeHtml(film.id)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.rating,
  ].filter(Boolean).join(' · ');

  const screeningItems = screenings.map(s => {
    const cinema = cinemaMap.get(s.cinemaId);
    const time = s.showtime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = s.showtime.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
    const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
    const label = `${date} ${time}` + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + attrs;
    return `<span class="screening">${label}</span>`;
  }).join('\n');

  return `<article class="film-card">
  <a href="/films/${escapeHtml(film.id)}" class="film-link">
    ${poster}
    <div class="film-info">
      <h2>${escapeHtml(film.title)}</h2>
      ${meta ? `<p class="film-meta">${escapeHtml(meta)}</p>` : ''}
    </div>
  </a>
  <div class="film-screenings">
    ${screeningItems}
  </div>
</article>`;
}

export { homePage };
