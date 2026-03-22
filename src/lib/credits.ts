import { escapeHtml } from './html.ts';

function arraysEqual(a: Array<string>, b: Array<string>): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

interface CreditOptions {
  directors?: Array<string>;
  writers?: Array<string>;
  cast?: Array<string>;
}

function formatCredits({ directors, writers, cast }: CreditOptions): string {
  const parts: Array<string> = [];

  if (directors?.length && writers?.length && arraysEqual(directors, writers)) {
    const label = directors.length > 1 ? 'Writers & Directors' : 'Writer & Director';
    parts.push(`<p><strong>${label}:</strong> ${directors.map(escapeHtml).join(', ')}</p>`);
  } else {
    if (directors?.length) {
      const label = directors.length > 1 ? 'Directors' : 'Director';
      parts.push(`<p><strong>${label}:</strong> ${directors.map(escapeHtml).join(', ')}</p>`);
    }
    if (writers?.length) {
      const label = writers.length > 1 ? 'Writers' : 'Writer';
      parts.push(`<p><strong>${label}:</strong> ${writers.map(escapeHtml).join(', ')}</p>`);
    }
  }

  if (cast?.length) {
    parts.push(`<p><strong>Cast:</strong> ${cast.map(escapeHtml).join(', ')}</p>`);
  }

  return parts.join('\n');
}

function formatCreditsMeta({ directors, writers }: CreditOptions): string {
  const parts: Array<string> = [];

  if (directors?.length && writers?.length && arraysEqual(directors, writers)) {
    const label = directors.length > 1 ? 'Writers & Directors' : 'Writer & Director';
    parts.push(`${label}: ${directors.map(escapeHtml).join(', ')}`);
  } else {
    if (directors?.length) {
      const label = directors.length > 1 ? 'Directors' : 'Director';
      parts.push(`${label}: ${directors.map(escapeHtml).join(', ')}`);
    }
    if (writers?.length) {
      const label = writers.length > 1 ? 'Writers' : 'Writer';
      parts.push(`${label}: ${writers.map(escapeHtml).join(', ')}`);
    }
  }

  return parts.join(' · ');
}

export { formatCredits, formatCreditsMeta };
