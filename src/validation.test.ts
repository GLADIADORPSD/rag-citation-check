import { describe, expect, it } from 'vitest';

import { validateClaimsInput, validateInlineInput } from './validation.js';

const inline = (answer: unknown = '', sources: unknown = []) => ({ answer, sources });
const claims = (claimItems: unknown = [], sources: unknown = []) => ({
  claims: claimItems,
  sources,
});
const claim = (citations: unknown = []) => ({ id: 'claim-1', text: 'Claim', citations });

describe('inline input validation', () => {
  it('accepts a valid input without cloning or mutating it', () => {
    const input = inline('Answer', [{ id: 'doc-a', content: 'Source' }]);
    const result = validateInlineInput(input);

    expect(result.kind).toBe('accepted');
    if (result.kind === 'accepted') {
      expect(result.value.input).toBe(input);
    }
  });

  it.each([
    [null, '$.answer'],
    [{}, '$.answer'],
    [inline(1), '$.answer'],
    [inline('', null), '$.sources'],
    [inline('', [null]), '$.sources'],
    [inline('', [{}]), '$.sources'],
    [inline('', [{ id: 1 }]), '$.sources'],
    [inline('', [{ id: '1', content: 1 }]), '$.sources'],
  ])('rejects malformed inline input %#', (input, path) => {
    expect(validateInlineInput(input)).toMatchObject({
      kind: 'rejected',
      error: { code: 'INPUT_INVALID', path },
    });
  });

  it('accepts an answer exactly at the configured UTF-8 byte limit', () => {
    expect(validateInlineInput(inline('é'), { limits: { answerBytes: 2 } }).kind).toBe('accepted');
  });

  it('rejects an answer above the configured UTF-8 byte limit', () => {
    expect(validateInlineInput(inline('é'), { limits: { answerBytes: 1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'ANSWER_LIMIT_EXCEEDED', path: '$.answer', limit: 1, actual: 2 },
    });
  });

  it('rejects a source count above the configured limit', () => {
    expect(
      validateInlineInput(inline('', [{ id: '1' }]), { limits: { sourceCount: 0 } }),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'SOURCE_COUNT_LIMIT_EXCEEDED', limit: 0, actual: 1 },
    });
  });

  it('returns option rejections before inspecting input', () => {
    expect(validateInlineInput(null, { limits: { answerBytes: -1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'OPTION_INVALID' },
    });
  });
});

describe('structured input validation', () => {
  it('accepts valid claims and optional fields', () => {
    const input = claims(
      [
        {
          id: 'claim-1',
          text: 'Claim',
          citationRequired: true,
          citations: [{ sourceId: 'doc-a', quote: 'evidence' }],
        },
      ],
      [{ id: 'doc-a', content: 'evidence' }],
    );
    const result = validateClaimsInput(input);

    expect(result.kind).toBe('accepted');
    if (result.kind === 'accepted') {
      expect(result.value.input).toBe(input);
    }
  });

  it.each([
    [null, '$.claims'],
    [{}, '$.claims'],
    [claims(null), '$.claims'],
    [claims([], null), '$.sources'],
    [claims([null]), '$.claims[0]'],
    [claims([{ text: 'Claim', citations: [] }]), '$.claims[0]'],
    [claims([{ id: '1', text: 1, citations: [] }]), '$.claims[0]'],
    [claims([{ id: '1', text: 'Claim', citationRequired: 'yes', citations: [] }]), '$.claims[0]'],
    [claims([{ id: '1', text: 'Claim', citations: null }]), '$.claims[0]'],
    [claims([claim([null])]), '$.claims[0].citations[0]'],
    [claims([claim([{}])]), '$.claims[0].citations[0]'],
    [claims([claim([{ sourceId: 1 }])]), '$.claims[0].citations[0]'],
    [claims([claim([{ sourceId: '1', quote: 1 }])]), '$.claims[0].citations[0]'],
  ])('rejects malformed structured input %#', (input, path) => {
    expect(validateClaimsInput(input)).toMatchObject({
      kind: 'rejected',
      error: { code: 'INPUT_INVALID', path },
    });
  });

  it('rejects a claim count above the configured limit', () => {
    expect(validateClaimsInput(claims([claim()]), { limits: { claimCount: 0 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'CLAIM_COUNT_LIMIT_EXCEEDED', limit: 0, actual: 1 },
    });
  });

  it('rejects a citation count above the per-claim limit', () => {
    expect(
      validateClaimsInput(claims([claim([{ sourceId: '1' }])]), {
        limits: { citationsPerClaim: 0 },
      }),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'CITATION_COUNT_LIMIT_EXCEEDED', limit: 0, actual: 1 },
    });
  });

  it('accepts a quote exactly at the configured UTF-8 byte limit', () => {
    expect(
      validateClaimsInput(claims([claim([{ sourceId: '1', quote: 'é' }])]), {
        limits: { quoteBytes: 2 },
      }).kind,
    ).toBe('accepted');
  });

  it('rejects a quote above the configured UTF-8 byte limit', () => {
    expect(
      validateClaimsInput(claims([claim([{ sourceId: '1', quote: 'é' }])]), {
        limits: { quoteBytes: 1 },
      }),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'QUOTE_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('rejects a total quote count above the configured limit', () => {
    expect(
      validateClaimsInput(
        claims([
          claim([
            { sourceId: '1', quote: 'first' },
            { sourceId: '1', quote: 'second' },
          ]),
        ]),
        { limits: { quoteCount: 1 } },
      ),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'QUOTE_COUNT_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });
});
