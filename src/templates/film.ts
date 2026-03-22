import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import { formatCredits } from '../lib/credits.ts';
import type { Film, Screening, Cinema } from '../types.ts';

interface FilmPageOptions {
  film: Film;
  screenings: Array<Screening>;
  cinemas: Array<Cinema>;
  fetchedAt?: Date;
  date?: string;
}

function filmPage({ film, screenings, cinemas, fetchedAt, date }: FilmPageOptions): string {
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const transitionName = date ? `poster-${film.id}-${date}` : `poster-${film.id}`;
  const poster = `<img src="${escapeHtml(film.posterUrl)}" alt="" class="film-poster-large" style="view-transition-name: ${escapeHtml(transitionName)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.rating,
  ].filter(Boolean).join(' · ');

  const credits = formatCredits(film);

  // Group screenings by date
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrowIso = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  const upcoming = screenings
    .filter(s => s.showtime > now)
    .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());

  const byDate = new Map<string, { label: string; screenings: Array<Screening> }>();
  for (const s of upcoming) {
    const isoDate = s.showtime.toISOString().slice(0, 10);
    let group = byDate.get(isoDate);
    if (!group) {
      const formatted = s.showtime.toLocaleDateString('en-150', { weekday: 'long', day: 'numeric', month: 'long' });
      const prefix = isoDate === todayIso ? 'Today — ' : isoDate === tomorrowIso ? 'Tomorrow — ' : '';
      group = { label: prefix + formatted, screenings: [] };
      byDate.set(isoDate, group);
    }
    group.screenings.push(s);
  }

  const screeningHtml = byDate.size === 0
    ? '<p>No upcoming screenings.</p>'
    : Array.from(byDate.entries()).map(([isoDate, { label, screenings: items }]) => {
        const highlighted = isoDate === date;
        const times = items.map(s => {
          const cinema = cinemaMap.get(s.cinemaId);
          const time = s.showtime.toLocaleTimeString('en-150', { hour: '2-digit', minute: '2-digit' });
          const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
          const href = `https://www.yorck.de/de/films/${escapeHtml(film.slug)}?date=${isoDate}#view_screening_times`;
          return `<a href="${href}" class="screening"><strong class="screening-time">${time}</strong>${attrs ? `<span class="screening-attrs">${attrs}</span>` : ''}${cinema ? `<span class="screening-cinema">${escapeHtml(cinema.name)}</span>` : ''}</a>`;
        }).join('\n');
        return `<div class="screening-date${highlighted ? ' screening-date-highlighted' : ''}">
  <h3>${escapeHtml(label)}</h3>
  <div class="screening-times">${times}</div>
</div>`;
      }).join('\n');

  const body = `<article class="film-detail">
  <h1 class="film-detail-title" style="view-transition-name: title-${escapeHtml(film.id)}${date ? `-${date}` : ''}"><span data-uncertain-lang>${escapeHtml(film.title)}</span>${film.releaseYear ? ` <span class="release-year">(${film.releaseYear})</span>` : ''}</h1>
  ${poster}
  <div class="film-detail-info">
    ${meta ? `<p class="film-meta">${escapeHtml(meta)}</p>` : ''}
    ${credits}
    ${film.synopsis ? `<div class="film-synopsis" lang="de">${escapeHtml(film.synopsis)}</div>` : ''}
    <nav class="film-links">
      <a href="https://www.yorck.de/de/films/${escapeHtml(film.slug)}"><img src="/yorck.svg" alt="View on Yorck.de" class="film-link-icon"></a>
      <a href="https://letterboxd.com/search/${encodeURIComponent(film.title)}/"><img src="/letterboxd.svg" alt="Search on Letterboxd" class="film-link-icon"></a>
      <a href="${film.traktSlug ? new URL(`/movies/${film.traktSlug}`, 'https://app.trakt.tv') : `https://app.trakt.tv/search?${new URLSearchParams({ m: 'movie', q: film.title })}`}"><img src="/trakt.svg" alt="${film.traktSlug ? 'View on' : 'Search on'} Trakt.tv" class="film-link-icon"></a>
    </nav>
  </div>
  <section class="screenings">
    <h2>Screenings</h2>
    ${screeningHtml}
  </section>
</article>`;

  return layout({ title: film.title, fetchedAt, body });
}

export { filmPage };
