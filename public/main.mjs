// @ts-check

const requestIdleCallback = globalThis.requestIdleCallback ?? ((cb) => setTimeout(cb, 3_000));

const rtf = new Intl.RelativeTimeFormat('en-150', { numeric: 'auto' });

/** @param {Date} date */
function relativeTime(date) {
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(Math.round(diffHours / 24), 'day');
}

function updateRelativeTimes() {
  for (const el of document.querySelectorAll('time[data-relative]')) {
    const datetime = el.getAttribute('datetime');
    if (datetime) el.textContent = relativeTime(new Date(datetime));
  }
  setTimeout(() => requestIdleCallback(updateRelativeTimes), 60_000);
}

updateRelativeTimes();

requestIdleCallback(() => {
  /** @type {HTMLElement | null} */
  const banner = document.getElementById('banner');
  /** @type {HTMLElement | null} */
  const bannerText = document.getElementById('banner-text');

  const events = new EventSource('/api/events');

  events.addEventListener('data-changed', () => {
    if (!banner || !bannerText) return;
    bannerText.innerHTML = 'Updated schedule available — <a href="">refresh</a>';
    banner.dataset.severity = 'info';
    banner.hidden = false;
  });

  events.addEventListener('data-unchanged', () => {
    if (!banner) return;
    banner.hidden = true;
  });

  events.onerror = () => {
    // Graceful degradation: SSE fails, page still works
    console.warn('SSE connection lost. Live updates unavailable.');
  };
});
