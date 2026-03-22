import { escapeHtml } from '../lib/html.ts';

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
  <link rel="stylesheet" href="/styles.css">

</head>
<body>
  <header>
    <a href="/">Yorck</a>
  </header>
  <div id="banner" class="banner"${fetchedAt ? '' : ' hidden'} data-severity=warning>
    <p id="banner-text">${bannerText}</p>
  </div>
  <main>${body}</main>
  <footer><small>This site is not affiliated with Yorck Kinogruppe.</small></footer>
  <script type="module" src="/main.mjs"></script>
</body>
</html>`;
}

export { layout };
export type { LayoutOptions };
