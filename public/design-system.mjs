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

/** @param {HTMLElement} container @param {string} prefix */
function renderGroupedSwatches(container, prefix) {
  const vars = allProps.filter(prop => prop.startsWith(prefix));
  const groups = new Map();
  for (const name of vars) {
    const rest = name.slice(prefix.length);
    const group = rest.replace(/-?\d+$/, '') || rest;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(name);
  }
  for (const [group, names] of groups) {
    const section = document.createElement('div');
    section.className = 'swatch-group';
    const heading = document.createElement('h3');
    const code = document.createElement('code');
    code.textContent = group;
    heading.appendChild(code);
    section.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'swatch-grid';
    for (const name of names) {
      const rest = name.slice(prefix.length);
      const label = rest.replace(/^.*-(?=\d)/, '');
      renderSwatch(grid, name, label);
    }
    section.appendChild(grid);
    container.appendChild(section);
  }
}

renderGroupedSwatches(document.getElementById('palette-swatches'), '--_palette-');
renderSwatches(document.getElementById('color-swatches'), '--color-');
