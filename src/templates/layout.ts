import { escapeHtml } from '../lib/html.ts';

interface LayoutOptions {
  title: string;
  stale?: boolean;
  body: string;
}

function layout({ title, stale = false, body }: LayoutOptions): string {
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
  <div id="banner" class="banner"${stale ? '' : ' hidden'}>
    <p id="banner-text">Schedule might be out of date</p>
  </div>
  <main>${body}</main>
  <footer><small>This site is not affiliated with Yorck Kinogruppe.</small></footer>
  <script type="module" src="/main.mjs"></script>
</body>
</html>`;
}

export { layout };
export type { LayoutOptions };
