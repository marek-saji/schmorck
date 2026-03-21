// @ts-check

const requestIdleCallback = globalThis.requestIdleCallback ?? ((cb) => setTimeout(cb, 3_000));

requestIdleCallback(() => {
  /** @type {HTMLElement | null} */
  const banner = document.getElementById('banner');
  /** @type {HTMLElement | null} */
  const bannerText = document.getElementById('banner-text');

  const events = new EventSource('/api/events');

  events.addEventListener('data-changed', () => {
    if (!banner || !bannerText) return;
    bannerText.innerHTML = 'Updated schedule available — <a href="">refresh</a>';
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
