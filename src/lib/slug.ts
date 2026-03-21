function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/&/g, 'and')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export { slugify };
