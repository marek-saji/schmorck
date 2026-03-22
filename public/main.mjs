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

const TRANSLATE_SELECTOR = '[lang="de"]:not(.original-text), [data-uncertain-lang]:not([lang])';

/** @type {Map<string, string>} */
const translationCache = new Map(
  Object.entries(JSON.parse(localStorage.getItem('translationCache') ?? '{}'))
);

function saveTranslationCache() {
  localStorage.setItem('translationCache', JSON.stringify(Object.fromEntries(translationCache)));
}

/**
 * @param {HTMLElement} el
 * @param {Translator} translator
 * @param {LanguageDetector | null} detector
 */
async function translateElement(el, translator, detector) {
  const original = el.textContent;
  if (!original?.trim()) return;

  // Detect language for uncertain elements
  if (el.hasAttribute('data-uncertain-lang')) {
    if (!detector) return;
    const results = await detector.detect(original);
    const lang = results[0]?.detectedLanguage;
    if (!lang) return;
    el.lang = lang;
    if (lang !== 'de') return;
  }

  const cached = translationCache.get(original);
  if (!cached) {
    el.insertAdjacentHTML('afterbegin', '<span class="translated-badge translating-badge">translating…</span> ');
  }
  const translated = cached ?? await translator.translate(original);
  if (!cached) {
    translationCache.set(original, translated);
    saveTranslationCache();
  }

  if (el.hasAttribute('data-uncertain-lang')) {
    // Title: show both translated and original
    el.innerHTML = `<span class="translated-badge">translated</span> ${translated} <span class="original-text" lang="de">${original}</span>`;
    el.lang = 'en';
  } else {
    // Synopsis: replace entirely
    el.innerHTML = `<span class="translated-badge">translated</span> ${translated}`;
    el.lang = 'en';
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
  const elements = document.querySelectorAll(TRANSLATE_SELECTOR);
  if (elements.length === 0) return;

  if (translatorAvailability === 'available') {
    const translator = await Translator.create({
      sourceLanguage: 'de',
      targetLanguage: 'en',
    });
    const detector = detectorAvailable ? await LanguageDetector.create() : null;

    /** @type {Map<Element, number>} */
    const pending = new Map();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const timer = setTimeout(() => {
            pending.delete(entry.target);
            observer.unobserve(entry.target);
            requestIdleCallback(() => {
              translateElement(/** @type {HTMLElement} */ (entry.target), translator, detector);
            });
          }, 200);
          pending.set(entry.target, timer);
        } else {
          const timer = pending.get(entry.target);
          if (timer != null) {
            clearTimeout(timer);
            pending.delete(entry.target);
          }
        }
      }
    }, { rootMargin: '100%' });

    for (const el of elements) {
      const text = el.textContent?.trim();
      if (text && translationCache.has(text)) {
        translateElement(/** @type {HTMLElement} */ (el), translator, detector);
      } else {
        observer.observe(el);
      }
    }
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
      /** @type {NodeListOf<HTMLElement>} */
      const allElements = document.querySelectorAll(TRANSLATE_SELECTOR);
      for (const el of allElements) {
        await translateElement(el, translator, detector);
      }
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
