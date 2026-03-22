import { escapeHtml } from '../lib/html.ts';

function designSystemPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Design System — Yorck</title>
  <link rel="stylesheet" href="/styles.css">
  <style>
    main {
      max-width: none;
    }
    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7em, 1fr));
      gap: var(--spacing-md);
    }
    .swatch {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-xs);
    }
    .swatch-color {
      height: 5em;
      border-radius: var(--radius-md);
      border: var(--thickness-border) solid var(--color-border);
    }
    .swatch-group {
      margin-bottom: var(--spacing-lg);
    }
    .swatch-group h3 {
      margin-bottom: var(--spacing-sm);
    }
    .swatch-name {
      font-size: var(--font-size-sm);
    }
  </style>
</head>
<body>
  <header>
    <a href="/">Yorck</a>
  </header>
  <main>
    <h1>Design System</h1>

    <template id="swatch-template">
      <div class="swatch">
        <div class="swatch-color"></div>
        <code class="swatch-name"></code>
      </div>
    </template>

    <section>
      <h2><code>--_palette</code></h2>
      <div id="palette-swatches" class="swatch-grid"></div>
    </section>

    <section>
      <h2><code>--color</code></h2>
      <div id="color-swatches" class="swatch-grid"></div>
    </section>
  </main>
  <script type="module" src="/design-system.mjs"></script>
</body>
</html>`;
}

export { designSystemPage };
