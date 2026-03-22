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

// ── Translate German text via Chrome Translator & Language Detector APIs ──

/**
 * @param {HTMLElement} el
 * @param {Translator} translator
 */
async function translateElement(el, translator) {
  const original = el.textContent;
  if (!original?.trim()) return;
  return new Promise(resolve => {
    requestIdleCallback(async () => {
      const translated = await translator.translate(original);
      el.innerHTML = '<span class="translated-badge">translated</span> ' + translated;
      el.lang = 'en';
      resolve();
    });
  });
}

/**
 * @param {Translator} translator
 * @param {LanguageDetector | null} detector
 */
async function translateAll(translator, detector) {
  /** @type {NodeListOf<HTMLElement>} */
  const elements = document.querySelectorAll('[lang="de"], [data-uncertain-lang]');
  for (const el of elements) {
    if (el.hasAttribute('data-uncertain-lang')) {
      const text = el.textContent?.trim();
      if (!text || !detector) continue;
      const results = await detector.detect(text);
      const lang = results[0]?.detectedLanguage;
      if (!lang) continue;
      el.lang = lang;
      el.removeAttribute('data-uncertain-lang');
      if (lang !== 'de') continue;
    }
    await translateElement(el, translator);
  }
}

requestIdleCallback(async () => {
  if (!('Translator' in globalThis)) return;

  const translatorAvailability = await Translator.availability({
    sourceLanguage: 'de',
    targetLanguage: 'en',
  });
  if (translatorAvailability === 'unavailable') return;

  const hasDetector = 'LanguageDetector' in globalThis;
  const detectorAvailable = hasDetector && await LanguageDetector.availability() === 'available';

  /** @type {NodeListOf<HTMLElement>} */
  const elements = document.querySelectorAll('[lang="de"], [data-uncertain-lang]');
  if (elements.length === 0) return;

  if (translatorAvailability === 'available') {
    const translator = await Translator.create({
      sourceLanguage: 'de',
      targetLanguage: 'en',
    });
    const detector = detectorAvailable ? await LanguageDetector.create() : null;
    await translateAll(translator, detector);
    return;
  }

  // downloadable or downloading — show button on [lang="de"] elements only
  for (const el of elements) {
    if (el.hasAttribute('data-uncertain-lang')) continue;
    const btn = document.createElement('button');
    btn.textContent = 'Translate';
    btn.className = 'translate-btn';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Translating…';
      const translator = await Translator.create({
        sourceLanguage: 'de',
        targetLanguage: 'en',
      });
      const detector = detectorAvailable ? await LanguageDetector.create() : null;
      await translateAll(translator, detector);
      for (const b of document.querySelectorAll('.translate-btn')) {
        b.remove();
      }
    }, { once: true });
    el.after(btn);
  }
});

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
