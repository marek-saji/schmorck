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
  <title>${escapeHtml(title)} — Schmorck</title>
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
      Schmorck
    </a>
    <div id="trakt-user"></div>
  </header>
  <main>${body}</main>
  <footer><small>This site is not affiliated with Yorck Kinogruppe.</small></footer>
  <div id="banner" class="banner"${fetchedAt ? '' : ' hidden'} data-severity=warning>
    <p id="banner-text">${bannerText}</p>
  </div>
  <template id="tpl-status-sections">
    <section class="status-group" data-state="new" aria-label="New"></section>
    <section class="status-group" data-state="watchlist" aria-label="Watchlist"></section>
    <section class="status-group" data-state="watched" aria-label="Watched"></section>
    <section class="status-group" data-state="ignore" aria-label="Not interested"></section>
  </template>
  <template id="tpl-trakt-user">
    <img src="" alt="" class="trakt-avatar">
    <span class="trakt-username"></span>
    <a href="/auth/trakt/logout" class="trakt-logout">Sign out</a>
  </template>
  <template id="tpl-trakt-signin">
    <a href="" class="trakt-signin">Sign in to Trakt.tv <img src="/images/services/trakt.svg" alt="" class="trakt-signin-icon"></a>
  </template>
  <template id="tpl-watchlist-btn-on">
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 2h14v20l-7-4-7 4V2z"/></svg>
  </template>
  <template id="tpl-watchlist-btn-off">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 2h14v20l-7-4-7 4V2z"/></svg>
  </template>
  <script type="module" src="/main.mjs"></script>
  <script type="module" src="/trakt.mjs"></script>
</body>
</html>`;
}

export { layout };
export type { LayoutOptions };
