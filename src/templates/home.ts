import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Film, Screening, Cinema } from '../types.ts';

interface HomeOptions {
  data: ScheduleData;
  fetchedAt?: Date;
}

function homePage({ data, fetchedAt }: HomeOptions): string {
  const { films, screenings, cinemas } = data;
  const filmMap = new Map(films.map(f => [f.id, f]));
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrowIso = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  const upcoming = screenings
    .filter(s => s.showtime > now)
    .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());

  // Group screenings: isoDate → filmId → screenings
  const byDate = new Map<string, { label: string; films: Map<string, Array<Screening>> }>();
  for (const s of upcoming) {
    const isoDate = s.showtime.toISOString().slice(0, 10);
    let dateGroup = byDate.get(isoDate);
    if (!dateGroup) {
      const formatted = s.showtime.toLocaleDateString('en-150', { weekday: 'long', day: 'numeric', month: 'long' });
      const prefix = isoDate === todayIso ? 'Today — ' : isoDate === tomorrowIso ? 'Tomorrow — ' : '';
      dateGroup = { label: prefix + formatted, films: new Map() };
      byDate.set(isoDate, dateGroup);
    }
    let filmGroup = dateGroup.films.get(s.scheduledFilmId);
    if (!filmGroup) {
      filmGroup = [];
      dateGroup.films.set(s.scheduledFilmId, filmGroup);
    }
    filmGroup.push(s);
  }

  if (byDate.size === 0) {
    return layout({ title: 'Schedule', fetchedAt, body: '<p>No upcoming screenings.</p>' });
  }

  const body = Array.from(byDate.entries()).map(([isoDate, { label, films: filmsForDate }]) => {
    const filmCards = Array.from(filmsForDate.entries()).map(([filmId, filmScreenings]) => {
      const film = filmMap.get(filmId);
      if (!film) return '';
      return filmCard(film, filmScreenings, cinemaMap, isoDate);
    }).join('\n');

    return `<section class="date-group">
  <h2 class="date-heading">${escapeHtml(label)}</h2>
  ${filmCards}
</section>`;
  }).join('\n');

  return layout({ title: 'Schedule', fetchedAt, body });
}

function filmCard(
  film: Film,
  screenings: Array<Screening>,
  cinemaMap: Map<string, Cinema>,
  isoDate: string,
): string {
  const poster = `<img src="${escapeHtml(film.posterUrl)}" alt="" class="film-poster" style="view-transition-name: poster-${escapeHtml(film.id)}-${isoDate}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.directors?.length ? `Director: ${film.directors.map(escapeHtml).join(', ')}` : null,
    film.writers?.length ? `Writer: ${film.writers.map(escapeHtml).join(', ')}` : null,
  ].filter(Boolean).join(' · ');

  const screeningItems = screenings.map(s => {
    const cinema = cinemaMap.get(s.cinemaId);
    const time = s.showtime.toLocaleTimeString('en-150', { hour: '2-digit', minute: '2-digit' });
    const date = s.showtime.toISOString().slice(0, 10);
    const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
    const href = `https://www.yorck.de/de/films/${escapeHtml(film.slug)}?date=${date}#view_screening_times`;
    return `<a href="${href}" class="screening"><strong class="screening-time">${time}</strong>${attrs ? `<span class="screening-attrs">${attrs}</span>` : ''}${cinema ? `<span class="screening-cinema">${escapeHtml(cinema.name)}</span>` : ''}</a>`;
  }).join('\n');

  return `<article class="film-card"${film.traktId ? ` data-trakt-id="${film.traktId}"` : ''}>
  <a href="/films/${escapeHtml(film.slug)}?date=${isoDate}" class="film-poster-link" tabindex="-1">
    ${poster}
  </a>
  <div class="film-body">
    <a href="/films/${escapeHtml(film.slug)}?date=${isoDate}" class="film-title-link">
      <h2 style="view-transition-name: title-${escapeHtml(film.id)}-${isoDate}"><span data-uncertain-lang>${escapeHtml(film.title)}</span>${film.releaseYear ? ` <span class="release-year">(${film.releaseYear})</span>` : ''}</h2>
    </a>
    ${meta ? `<p class="film-meta">${meta}</p>` : ''}
    ${film.synopsis ? `<p class="film-synopsis-short" lang="de">${escapeHtml(film.synopsis)}</p>` : ''}
    <div class="film-screenings">
      ${screeningItems}
    </div>
  </div>
</article>`;
}

export { homePage };
