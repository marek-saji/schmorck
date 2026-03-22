// @ts-check

const template = document.getElementById('swatch-template');
const styles = getComputedStyle(document.documentElement);

const allProps = Array.from(document.styleSheets)
  .flatMap(sheet => {
    try { return Array.from(sheet.cssRules); } catch { return []; }
  })
  .filter(rule => rule instanceof CSSStyleRule && rule.selectorText === ':root')
  .flatMap(rule => Array.from(rule.style));

/** @param {HTMLElement} container @param {string} name @param {string} label */
function renderSwatch(container, name, label) {
  const clone = template.content.cloneNode(true);
  clone.querySelector('.swatch-color').style.background = `var(${name})`;
  clone.querySelector('.swatch-name').textContent = label;
  container.appendChild(clone);
}

/** @param {HTMLElement} container @param {string} prefix */
function renderSwatches(container, prefix) {
  const vars = allProps.filter(prop => prop.startsWith(prefix));
  for (const name of vars) {
    renderSwatch(container, name, name.slice(prefix.length));
  }
}

/** @param {HTMLElement} container @param {string} name @param {string} label */
function renderEmptySwatch(container, label) {
  const clone = template.content.cloneNode(true);
  clone.querySelector('.swatch').style.opacity = '0.3';
  clone.querySelector('.swatch-color').style.background = 'repeating-linear-gradient(45deg, transparent, transparent 0.5em, var(--color-border) 0.5em, var(--color-border) 1em)';
  clone.querySelector('.swatch-name').textContent = label;
  container.appendChild(clone);
}

/** @param {HTMLElement} container @param {string} prefix */
function renderGroupedSwatches(container, prefix) {
  const vars = allProps.filter(prop => prop.startsWith(prefix));

  // Collect groups and all unique values (numeric suffixes)
  /** @type {Map<string, Map<string, string>>} group → (value → varName) */
  const groups = new Map();
  /** @type {Set<string>} */
  const allValues = new Set();

  for (const name of vars) {
    const rest = name.slice(prefix.length);
    const group = rest.replace(/-?\d+$/, '') || rest;
    const value = rest.replace(/^.*-(?=\d)/, '');
    if (!groups.has(group)) groups.set(group, new Map());
    groups.get(group).set(value, name);
    allValues.add(value);
  }

  const sortedValues = [...allValues].sort((a, b) => Number(a) - Number(b));

  for (const [group, valueMap] of groups) {
    const section = document.createElement('div');
    section.className = 'swatch-group';
    const heading = document.createElement('h3');
    const code = document.createElement('code');
    code.textContent = group;
    heading.appendChild(code);
    section.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'swatch-grid';
    for (const value of sortedValues) {
      const varName = valueMap.get(value);
      if (varName) {
        renderSwatch(grid, varName, value);
      } else {
        renderEmptySwatch(grid, value);
      }
    }
    section.appendChild(grid);
    container.appendChild(section);
  }
}

renderGroupedSwatches(document.getElementById('palette-swatches'), '--_palette-');
renderSwatches(document.getElementById('color-swatches'), '--color-');
