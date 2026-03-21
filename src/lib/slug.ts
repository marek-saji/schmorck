const GERMAN_CHARS: Record<string, string> = {
  'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss',
};

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[äöüß]/g, ch => GERMAN_CHARS[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export { slugify };
