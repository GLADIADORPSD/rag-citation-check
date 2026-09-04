import { describe, expect, it } from 'vitest';

import { matchQuote, prepareQuoteSource } from './quote-matcher.js';

const match = (source: string, quote: string, mode: 'exact' | 'normalized-whitespace' = 'exact') =>
  matchQuote(prepareQuoteSource(source, mode), quote);

describe('quote matcher', () => {
  it('returns an original UTF-16 range for one exact occurrence', () => {
    expect(match('😀 evidence', 'evidence')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 3, end: 11 },
    });
  });

  it('detects overlapping ambiguity without selecting a range', () => {
    expect(match('aaa', 'aa')).toEqual({ kind: 'matched', ambiguous: true });
  });

  it('keeps exact mode sensitive to line endings', () => {
    expect(match('A\r\nB', 'A\nB')).toEqual({ kind: 'not-found' });
  });

  it('normalizes NFC and maps a composed match to the decomposed original', () => {
    expect(match('Cafe\u0301', 'Café', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 0, end: 5 },
    });
  });

  it('normalizes Hangul Jamo composition and preserves its original range', () => {
    expect(match('\u1100\u1161 text', '가', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 0, end: 2 },
    });
  });

  it('maps a trailing Jamo composed with an existing Hangul LV syllable', () => {
    expect(match('가\u11a8', '각', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 0, end: 2 },
    });
  });

  it('handles an NFC expansion without losing its original range', () => {
    expect(match('\u0344', '\u0308\u0301', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 0, end: 1 },
    });
  });

  it('collapses ECMAScript whitespace and maps the entire original run', () => {
    expect(match('A\r\n\t  B', 'A B', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 0, end: 7 },
    });
  });

  it('trims normalized boundaries without broadening the source range', () => {
    expect(match('  evidence  ', '\n evidence\t', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: false,
      sourceRange: { start: 2, end: 10 },
    });
  });

  it('does not normalize case, accents, or punctuation', () => {
    expect(match('Evidence', 'evidence', 'normalized-whitespace')).toEqual({ kind: 'not-found' });
    expect(match('cafe', 'café', 'normalized-whitespace')).toEqual({ kind: 'not-found' });
    expect(match('yes.', 'yes', 'normalized-whitespace')).toMatchObject({ kind: 'matched' });
    expect(match('yes', 'yes.', 'normalized-whitespace')).toEqual({ kind: 'not-found' });
  });

  it('detects ambiguity after whitespace normalization', () => {
    expect(match('A\tB and A  B', 'A B', 'normalized-whitespace')).toEqual({
      kind: 'matched',
      ambiguous: true,
    });
  });

  it.each(['', ' ', '\t\r\n'])('classifies an empty quote before searching: %j', (quote) => {
    expect(match('anything', quote)).toEqual({ kind: 'empty' });
  });

  it('is deterministic for malformed Unicode and does not crash', () => {
    const first = match(`A\ud800  B`, `A\ud800 B`, 'normalized-whitespace');
    expect(first).toEqual(match(`A\ud800  B`, `A\ud800 B`, 'normalized-whitespace'));
    expect(first).toMatchObject({ kind: 'matched', ambiguous: false });
  });

  it('matches the documented normalization pipeline across a seeded Unicode corpus', () => {
    let state = 0x4e46_4321;
    const alphabet = [
      'a',
      'e',
      '\u0301',
      '\u0327',
      '\u0344',
      '\u1100',
      '\u1161',
      '\u11a8',
      '가',
      '\r',
      '\n',
      '\t',
      '\u00a0',
      '\ud800',
    ];
    const next = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };

    for (let caseIndex = 0; caseIndex < 1_000; caseIndex += 1) {
      let value = '';
      const length = next() % 64;
      for (let index = 0; index < length; index += 1) {
        value += alphabet[next() % alphabet.length] ?? '';
      }

      const prepared = prepareQuoteSource(value, 'normalized-whitespace');
      expect(prepared.mode).toBe('normalized-whitespace');
      if (prepared.mode === 'normalized-whitespace') {
        expect(prepared.value.value).toBe(value.normalize('NFC').replace(/\s+/gu, ' ').trim());
        expect(prepared.value.originalStarts).toHaveLength(prepared.value.value.length);
        expect(prepared.value.originalEnds).toHaveLength(prepared.value.value.length);
      }
    }
  });
});
