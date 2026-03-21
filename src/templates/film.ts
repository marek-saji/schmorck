import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { Film, Screening, Cinema } from '../types.ts';

interface FilmPageOptions {
  film: Film;
  screenings: Screening[];
  cinemas: Cinema[];
  stale: boolean;
}

function filmPage({ film, screenings, cinemas, stale }: FilmPageOptions): string {
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const poster = `<img src="/posters/${escapeHtml(film.id)}" alt="" class="film-poster-large" style="view-transition-name: poster-${escapeHtml(film.id)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.rating,
  ].filter(Boolean).join(' · ');

  const credits = [
    film.cast?.length ? `<p><strong>Cast:</strong> ${film.cast.map(escapeHtml).join(', ')}</p>` : '',
  ].filter(Boolean).join('\n');

  // Group screenings by date
  const now = new Date();
  const upcoming = screenings
    .filter(s => s.showtime > now)
    .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());

  const byDate = new Map<string, Screening[]>();
  for (const s of upcoming) {
    const dateKey = s.showtime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const group = byDate.get(dateKey) ?? [];
    group.push(s);
    byDate.set(dateKey, group);
  }

  const screeningHtml = byDate.size === 0
    ? '<p>No upcoming screenings.</p>'
    : Array.from(byDate.entries()).map(([date, items]) => {
        const times = items.map(s => {
          const cinema = cinemaMap.get(s.cinemaId);
          const time = s.showtime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
          const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
          const label = time + (cinema ? ` ${escapeHtml(cinema.name)}` : '') + attrs;
          return `<span class="screening">${label}</span>`;
        }).join('\n');
        return `<div class="screening-date">
  <h3>${escapeHtml(date)}</h3>
  <div class="screening-times">${times}</div>
</div>`;
      }).join('\n');

  const body = `<article class="film-detail">
  ${poster}
  <div class="film-detail-info">
    <h1>${escapeHtml(film.title)}</h1>
    ${meta ? `<p class="film-meta">${escapeHtml(meta)}</p>` : ''}
    ${credits}
    ${film.synopsis ? `<div class="film-synopsis">${escapeHtml(film.synopsis)}</div>` : ''}
  </div>
  <section class="screenings">
    <h2>Screenings</h2>
    ${screeningHtml}
  </section>
</article>`;

  return layout({ title: film.title, stale, body });
}

export { filmPage };
