import { layout } from './layout.ts';
import { escapeHtml } from '../lib/html.ts';
import type { ScheduleData, Film, Screening, Cinema } from '../types.ts';

interface HomeOptions {
  data: ScheduleData;
  stale: boolean;
}

function homePage({ data, stale }: HomeOptions): string {
  const { films, screenings, cinemas } = data;
  const filmMap = new Map(films.map(f => [f.id, f]));
  const cinemaMap = new Map(cinemas.map(c => [c.id, c]));

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const tomorrowIso = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

  const upcoming = screenings
    .filter(s => s.showtime > now)
    .sort((a, b) => a.showtime.getTime() - b.showtime.getTime());

  // Group screenings: date → filmId → screenings
  const byDate = new Map<string, Map<string, Screening[]>>();
  for (const s of upcoming) {
    const isoDate = s.showtime.toISOString().slice(0, 10);
    const formatted = s.showtime.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const prefix = isoDate === todayIso ? 'Today — ' : isoDate === tomorrowIso ? 'Tomorrow — ' : '';
    const dateKey = prefix + formatted;
    let dateGroup = byDate.get(dateKey);
    if (!dateGroup) {
      dateGroup = new Map();
      byDate.set(dateKey, dateGroup);
    }
    let filmGroup = dateGroup.get(s.scheduledFilmId);
    if (!filmGroup) {
      filmGroup = [];
      dateGroup.set(s.scheduledFilmId, filmGroup);
    }
    filmGroup.push(s);
  }

  if (byDate.size === 0) {
    return layout({ title: 'Schedule', stale, body: '<p>No upcoming screenings.</p>' });
  }

  const body = Array.from(byDate.entries()).map(([date, filmsForDate]) => {
    const filmCards = Array.from(filmsForDate.entries()).map(([filmId, filmScreenings]) => {
      const film = filmMap.get(filmId);
      if (!film) return '';
      return filmCard(film, filmScreenings, cinemaMap);
    }).join('\n');

    return `<section class="date-group">
  <h2 class="date-heading">${escapeHtml(date)}</h2>
  ${filmCards}
</section>`;
  }).join('\n');

  return layout({ title: 'Schedule', stale, body });
}

function filmCard(
  film: Film,
  screenings: Screening[],
  cinemaMap: Map<string, Cinema>,
): string {
  const poster = `<img src="${escapeHtml(film.posterUrl)}" alt="" class="film-poster" style="view-transition-name: poster-${escapeHtml(film.id)}">`;

  const meta = [
    film.runTime ? `${film.runTime} min` : null,
    film.directors?.length ? `Director: ${film.directors.map(escapeHtml).join(', ')}` : null,
    film.writers?.length ? `Writer: ${film.writers.map(escapeHtml).join(', ')}` : null,
  ].filter(Boolean).join(' · ');

  const screeningItems = screenings.map(s => {
    const cinema = cinemaMap.get(s.cinemaId);
    const time = s.showtime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const date = s.showtime.toISOString().slice(0, 10);
    const attrs = s.attributes?.length ? ` ${s.attributes.map(escapeHtml).join(' ')}` : '';
    const href = `https://www.yorck.de/de/films/${escapeHtml(film.slug)}?date=${date}#view_screening_times`;
    return `<a href="${href}" class="screening"><strong class="screening-time">${time}</strong>${attrs ? `<span class="screening-attrs">${attrs}</span>` : ''}${cinema ? `<span class="screening-cinema">${escapeHtml(cinema.name)}</span>` : ''}</a>`;
  }).join('\n');

  return `<article class="film-card">
  <a href="/films/${escapeHtml(film.slug)}" class="film-poster-link">
    ${poster}
  </a>
  <div class="film-body">
    <a href="/films/${escapeHtml(film.slug)}" class="film-title-link">
      <h2>${escapeHtml(film.title)}</h2>
    </a>
    ${meta ? `<p class="film-meta">${meta}</p>` : ''}
    ${film.synopsis ? `<p class="film-synopsis-short">${escapeHtml(film.synopsis)}</p>` : ''}
    <div class="film-screenings">
      ${screeningItems}
    </div>
  </div>
</article>`;
}

export { homePage };
