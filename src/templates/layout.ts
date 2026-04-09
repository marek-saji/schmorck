import { escapeHtml } from '../lib/html.ts';
import { TRAKT_CLIENT_ID, APP_URL } from '../lib/env.ts';

interface LayoutOptions {
  title: string;
  fetchedAt?: Date;
  body: string;
}

function layout({ title, fetchedAt, body }: LayoutOptions): string {
  const bannerText = fetchedAt
    ? `Schedule fetched <time datetime="${fetchedAt.toISOString()}" data-relative>${fetchedAt.toLocaleString('en-150')}</time> and might be out of date`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Yorck</title>
  <meta name="theme-color" content="#111111">
  <link rel="stylesheet" href="/styles.css">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/images/icons/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/images/icons/icon.svg">
  <meta name="trakt" content='${escapeHtml(JSON.stringify({ clientId: TRAKT_CLIENT_ID }))}'>
</head>
<body>
  <header>
    <a href="/">
      <img
        alt=""
        src="/images/icons/icon.svg"
        width="32" height="32"
        class="header-logo"
      >
      Yorck
    </a>
    <div id="trakt-user"></div>
  </header>
  <div id="banner" class="banner"${fetchedAt ? '' : ' hidden'} data-severity=warning>
    <p id="banner-text">${bannerText}</p>
  </div>
  <main>${body}</main>
  <footer><small>This site is not affiliated with Yorck Kinogruppe.</small></footer>
  <script type="module" src="/main.mjs"></script>
  <script type="module" src="/trakt.mjs"></script>
</body>
</html>`;
}

export { layout };
export type { LayoutOptions };
