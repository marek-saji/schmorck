import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCredits, formatCreditsMeta } from './credits.ts';

describe('formatCredits', () => {
  it('returns empty string when no credits', () => {
    assert.equal(formatCredits({}), '');
  });

  it('shows single director', () => {
    const result = formatCredits({ directors: ['Sean Baker'] });
    assert.ok(result.includes('Director:'));
    assert.ok(result.includes('Sean Baker'));
    assert.ok(!result.includes('Directors'));
  });

  it('shows multiple directors', () => {
    const result = formatCredits({ directors: ['Joel Coen', 'Ethan Coen'] });
    assert.ok(result.includes('Directors:'));
    assert.ok(result.includes('Joel Coen, Ethan Coen'));
  });

  it('shows single writer', () => {
    const result = formatCredits({ writers: ['Charlie Kaufman'] });
    assert.ok(result.includes('Writer:'));
    assert.ok(result.includes('Charlie Kaufman'));
    assert.ok(!result.includes('Writers'));
  });

  it('shows director and writer separately when different', () => {
    const result = formatCredits({ directors: ['Denis Villeneuve'], writers: ['Jon Spaihts'] });
    assert.ok(result.includes('Director:'));
    assert.ok(result.includes('Writer:'));
    assert.ok(result.includes('Denis Villeneuve'));
    assert.ok(result.includes('Jon Spaihts'));
  });

  it('combines director and writer when same person', () => {
    const result = formatCredits({ directors: ['Sean Baker'], writers: ['Sean Baker'] });
    assert.ok(result.includes('Writer & Director:'));
    assert.ok(result.includes('Sean Baker'));
    assert.equal(result.match(/Sean Baker/g)?.length, 1);
  });

  it('combines multiple directors and writers when same people', () => {
    const result = formatCredits({ directors: ['Joel Coen', 'Ethan Coen'], writers: ['Joel Coen', 'Ethan Coen'] });
    assert.ok(result.includes('Writers & Directors:'));
  });

  it('does not combine when order differs', () => {
    const result = formatCredits({ directors: ['Joel Coen', 'Ethan Coen'], writers: ['Ethan Coen', 'Joel Coen'] });
    assert.ok(result.includes('Directors:'));
    assert.ok(result.includes('Writers:'));
  });

  it('shows cast', () => {
    const result = formatCredits({ cast: ['Mikey Madison', 'Mark Eydelshteyn'] });
    assert.ok(result.includes('Cast:'));
    assert.ok(result.includes('Mikey Madison, Mark Eydelshteyn'));
  });

  it('shows all three', () => {
    const result = formatCredits({
      directors: ['Sean Baker'],
      writers: ['Sean Baker'],
      cast: ['Mikey Madison'],
    });
    assert.ok(result.includes('Writer & Director:'));
    assert.ok(result.includes('Cast:'));
  });

  it('escapes HTML in names', () => {
    const result = formatCredits({ directors: ['<script>alert(1)</script>'] });
    assert.ok(!result.includes('<script>'));
    assert.ok(result.includes('&lt;script&gt;'));
  });
});

describe('formatCreditsMeta', () => {
  it('returns empty string when no credits', () => {
    assert.equal(formatCreditsMeta({}), '');
  });

  it('shows director without HTML tags', () => {
    const result = formatCreditsMeta({ directors: ['Sean Baker'] });
    assert.equal(result, 'Director: Sean Baker');
  });

  it('separates director and writer with ·', () => {
    const result = formatCreditsMeta({ directors: ['Denis Villeneuve'], writers: ['Jon Spaihts'] });
    assert.equal(result, 'Director: Denis Villeneuve · Writer: Jon Spaihts');
  });

  it('combines director and writer when same person', () => {
    const result = formatCreditsMeta({ directors: ['Sean Baker'], writers: ['Sean Baker'] });
    assert.equal(result, 'Writer & Director: Sean Baker');
  });

  it('ignores cast', () => {
    const result = formatCreditsMeta({ cast: ['Mikey Madison'] });
    assert.equal(result, '');
  });
});
