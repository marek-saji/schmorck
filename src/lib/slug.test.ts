import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slug.ts';

describe('slugify', () => {
  it('lowercases', () => {
    assert.equal(slugify('Anora'), 'anora');
  });

  it('replaces german letters', () => {
    assert.equal(slugify('Über die Grenze'), 'uber-die-grenze');
    assert.equal(slugify('Ärger mit Öl und Süße'), 'arger-mit-ol-und-susse');
  });

  it('replaces special characters with dashes', () => {
    assert.equal(slugify("L'Grazia — Part 2!"), 'l-grazia-part-2');
  });

  it('trims leading and trailing dashes', () => {
    assert.equal(slugify('--hello--'), 'hello');
  });

  it('collapses multiple dashes', () => {
    assert.equal(slugify('a   b   c'), 'a-b-c');
  });
});
