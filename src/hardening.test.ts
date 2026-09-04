import { describe, expect, it } from 'vitest';

import { INLINE_CORPUS } from './__fixtures__/inline-corpus.js';
import { STRUCTURED_CORPUS } from './__fixtures__/structured-corpus.js';
import { checkCitationClaims } from './check-claims.js';
import { checkInlineCitations } from './check-inline.js';
import type { CitationCheckResult, CitationFindingCode } from './contracts.js';
import { parseInlineCitations } from './inline-parser.js';

const rejectionCode = (result: CitationCheckResult): string => {
  if (result.kind !== 'rejected') {
    throw new Error('Expected a rejected operation.');
  }
  return result.error.code;
};

describe('hardening corpus F28-F32', () => {
  it('F28 processes an answer exactly at its UTF-8 byte limit', () => {
    expect(parseInlineCitations('é', { limits: { answerBytes: 2 } })).toMatchObject({
      kind: 'completed',
      report: { outcome: 'pass' },
    });
  });

  it('F29 rejects an answer one UTF-8 byte above its limit', () => {
    expect(parseInlineCitations('aé', { limits: { answerBytes: 2 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'ANSWER_LIMIT_EXCEEDED', limit: 2, actual: 3 },
    });
  });

  it('F30 handles isolated surrogates deterministically in both public modes', () => {
    const inlineInput = { answer: 'Result [1]\ud800.', sources: [{ id: '1' }] };
    const structuredInput = {
      claims: [
        {
          id: 'claim-1',
          text: '\ud800',
          citations: [{ sourceId: 'doc', quote: 'A\ud800 B' }],
        },
      ],
      sources: [{ id: 'doc', content: 'A\ud800  B' }],
    };

    expect(checkInlineCitations(inlineInput)).toEqual(checkInlineCitations(inlineInput));
    expect(
      checkCitationClaims(structuredInput, { quoteMatching: 'normalized-whitespace' }),
    ).toEqual(checkCitationClaims(structuredInput, { quoteMatching: 'normalized-whitespace' }));
  });

  it('F31 bounds thousands of incomplete citation groups without one finding per bracket', () => {
    const answer = '[1\n'.repeat(20_000);
    const result = parseInlineCitations(answer, { limits: { findingCount: 128 } });

    expect(result).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 128, actual: 129 },
    });
  });

  it('F32 serializes repeated inline and structured reports to identical bytes', () => {
    const inline = { answer: 'Result [1].', sources: [{ id: '1' }] };
    const structured = STRUCTURED_CORPUS[8];
    if (structured === undefined) {
      throw new Error('F25 fixture is missing.');
    }

    expect(JSON.stringify(checkInlineCitations(inline))).toBe(
      JSON.stringify(checkInlineCitations(inline)),
    );
    expect(JSON.stringify(checkCitationClaims(structured.input, structured.options))).toBe(
      JSON.stringify(checkCitationClaims(structured.input, structured.options)),
    );
  });
});

describe('public code coverage', () => {
  it('covers every 0.1.0 finding code through the named failure corpus', () => {
    const actual = new Set<CitationFindingCode>([
      ...INLINE_CORPUS.flatMap((fixture) => fixture.findingCodes),
      ...STRUCTURED_CORPUS.flatMap((fixture) => fixture.findingCodes),
    ]);

    expect([...actual].sort()).toEqual(
      [
        'SOURCE_ID_INVALID',
        'SOURCE_ID_DUPLICATE',
        'CITATION_MALFORMED',
        'CITATION_SOURCE_UNKNOWN',
        'CITATION_DUPLICATE_IN_GROUP',
        'CLAIM_CITATION_REQUIRED',
        'QUOTE_EMPTY',
        'SOURCE_CONTENT_MISSING',
        'QUOTE_NOT_FOUND',
        'QUOTE_MATCH_AMBIGUOUS',
        'SOURCE_UNUSED',
      ].sort(),
    );
  });

  it('directly exercises every 0.1.0 rejection code', () => {
    const baseClaim = { id: 'claim-1', text: 'Claim', citations: [] };
    const results = [
      checkInlineCitations(null as never),
      checkInlineCitations({ answer: '', sources: [] }, { limits: { answerBytes: -1 } }),
      checkInlineCitations({ answer: 'é', sources: [] }, { limits: { answerBytes: 1 } }),
      checkInlineCitations({ answer: '', sources: [{ id: '1' }] }, { limits: { sourceCount: 0 } }),
      checkInlineCitations(
        { answer: '', sources: [{ id: '1', content: 'é' }] },
        { limits: { sourceContentBytes: 1 } },
      ),
      checkInlineCitations(
        {
          answer: '',
          sources: [
            { id: '1', content: 'a' },
            { id: '2', content: 'b' },
          ],
        },
        { limits: { totalSourceContentBytes: 1 } },
      ),
      checkCitationClaims({ claims: [baseClaim], sources: [] }, { limits: { claimCount: 0 } }),
      checkCitationClaims(
        {
          claims: [{ ...baseClaim, citations: [{ sourceId: '1' }] }],
          sources: [],
        },
        { limits: { citationsPerClaim: 0 } },
      ),
      checkCitationClaims(
        {
          claims: [{ ...baseClaim, citations: [{ sourceId: '1', quote: 'é' }] }],
          sources: [],
        },
        { limits: { quoteBytes: 1 } },
      ),
      checkCitationClaims(
        {
          claims: [{ ...baseClaim, citations: [{ sourceId: '1', quote: 'a' }] }],
          sources: [],
        },
        { limits: { quoteCount: 0 } },
      ),
      checkInlineCitations({ answer: '[1,] [2,]', sources: [] }, { limits: { findingCount: 1 } }),
    ];

    expect(results.map(rejectionCode).sort()).toEqual(
      [
        'INPUT_INVALID',
        'OPTION_INVALID',
        'ANSWER_LIMIT_EXCEEDED',
        'SOURCE_COUNT_LIMIT_EXCEEDED',
        'SOURCE_CONTENT_LIMIT_EXCEEDED',
        'TOTAL_CONTENT_LIMIT_EXCEEDED',
        'CLAIM_COUNT_LIMIT_EXCEEDED',
        'CITATION_COUNT_LIMIT_EXCEEDED',
        'QUOTE_LIMIT_EXCEEDED',
        'QUOTE_COUNT_LIMIT_EXCEEDED',
        'FINDING_LIMIT_EXCEEDED',
      ].sort(),
    );
  });
});

describe('structured range properties', () => {
  it('keeps normalized matches in bounds across a seeded Unicode and whitespace corpus', () => {
    let state = 0xc17a_7100;
    const next = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };
    const variants = [
      { source: 'A\r\n\tB', quote: 'A B' },
      { source: 'Cafe\u0301', quote: 'Café' },
      { source: '\u1100\u1161', quote: '가' },
      { source: 'alpha\u00a0\u2003beta', quote: 'alpha beta' },
    ];
    const normalize = (value: string): string =>
      value.normalize('NFC').replace(/\s+/gu, ' ').trim();

    for (let caseIndex = 0; caseIndex < 1_000; caseIndex += 1) {
      const variant = variants[next() % variants.length];
      if (variant === undefined) {
        throw new Error('Seeded corpus selected an invalid variant.');
      }
      const prefix = `prefix-${String(caseIndex)}:`;
      const suffix = `:suffix-${String(caseIndex)}`;
      const source = `${prefix}${variant.source}${suffix}`;
      const input = {
        claims: [
          {
            id: `claim-${String(caseIndex)}`,
            text: 'Claim',
            citations: [{ sourceId: 'doc', quote: variant.quote }],
          },
        ],
        sources: [{ id: 'doc', content: source }],
      };
      const first = checkCitationClaims(input, { quoteMatching: 'normalized-whitespace' });

      expect(first).toEqual(checkCitationClaims(input, { quoteMatching: 'normalized-whitespace' }));
      expect(first.kind).toBe('completed');
      if (first.kind === 'completed') {
        const match = first.report.quoteMatches[0];
        expect(match?.ambiguous).toBe(false);
        if (match?.ambiguous === false) {
          expect(match.sourceRange.start).toBeGreaterThanOrEqual(0);
          expect(match.sourceRange.end).toBeLessThanOrEqual(source.length);
          expect(match.sourceRange.start).toBeLessThan(match.sourceRange.end);
          expect(normalize(source.slice(match.sourceRange.start, match.sourceRange.end))).toBe(
            normalize(variant.quote),
          );
        }
      }
    }
  });
});
