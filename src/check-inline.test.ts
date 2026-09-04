import { describe, expect, it } from 'vitest';

import { INLINE_CORPUS } from './__fixtures__/inline-corpus.js';
import { checkInlineCitations } from './check-inline.js';

describe('inline failure corpus F01-F16', () => {
  it.each(INLINE_CORPUS)('$id', (fixture) => {
    const result = checkInlineCitations({ answer: fixture.answer, sources: fixture.sources });

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.outcome).toBe(fixture.outcome);
      expect(result.report.assessments).toMatchObject({
        sourceCatalog: fixture.sourceCatalog,
        citationSyntax: fixture.citationSyntax,
        sourceReference: fixture.sourceReference,
        citationCoverage: 'not-assessed',
        quotePresence: 'not-assessed',
        semanticSupport: 'not-assessed',
        sourceTrust: 'not-assessed',
        factualTruth: 'not-assessed',
      });
      expect(result.report.statistics.citationCount).toBe(fixture.citationCount);
      expect(result.report.findings.map((finding) => finding.code)).toEqual(fixture.findingCodes);
    }
  });

  it('does not mutate input arrays or source objects', () => {
    const sources = Object.freeze([Object.freeze({ id: '1', content: 'Source' })]);
    const input = Object.freeze({ answer: 'Result [1].', sources });

    expect(checkInlineCitations(input)).toMatchObject({
      kind: 'completed',
      report: { outcome: 'pass' },
    });
    expect(input.sources).toBe(sources);
  });

  it('orders mixed findings deterministically and serializes identically', () => {
    const input = {
      answer: 'Unknown [2, 2] malformed [1,].',
      sources: [{ id: 'bad id' }],
    };
    const first = checkInlineCitations(input);
    const second = checkInlineCitations(input);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.kind).toBe('completed');
    if (first.kind === 'completed') {
      expect(first.report.findings.map((finding) => finding.code)).toEqual([
        'CITATION_SOURCE_UNKNOWN',
        'CITATION_DUPLICATE_IN_GROUP',
        'CITATION_SOURCE_UNKNOWN',
        'CITATION_MALFORMED',
        'SOURCE_ID_INVALID',
      ]);
      expect(first.report.statistics).toMatchObject({
        sourceCount: 1,
        claimCount: 0,
        citationCount: 2,
        findingCount: 5,
        errorCount: 4,
        warningCount: 1,
        infoCount: 0,
      });
    }
  });

  it('rejects when combined catalog and parser findings exceed the configured limit', () => {
    expect(
      checkInlineCitations(
        { answer: 'Malformed [1,].', sources: [{ id: 'bad id' }] },
        { limits: { findingCount: 1 } },
      ),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('rejects when unknown references exceed the remaining finding capacity', () => {
    expect(
      checkInlineCitations(
        { answer: 'Unknown [1, 2].', sources: [] },
        { limits: { findingCount: 1 } },
      ),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('propagates input, option, catalog, and parser limit rejections', () => {
    expect(checkInlineCitations(null as never)).toMatchObject({
      kind: 'rejected',
      error: { code: 'INPUT_INVALID' },
    });
    expect(
      checkInlineCitations({ answer: '', sources: [] }, { limits: { answerBytes: -1 } }),
    ).toMatchObject({ kind: 'rejected', error: { code: 'OPTION_INVALID' } });
    expect(
      checkInlineCitations(
        { answer: '', sources: [{ id: '1', content: 'aa' }] },
        { limits: { sourceContentBytes: 1 } },
      ),
    ).toMatchObject({ kind: 'rejected', error: { code: 'SOURCE_CONTENT_LIMIT_EXCEEDED' } });
    expect(
      checkInlineCitations(
        { answer: '[1, 2]', sources: [{ id: '1' }, { id: '2' }] },
        { limits: { citationsPerClaim: 1 } },
      ),
    ).toMatchObject({ kind: 'rejected', error: { code: 'CITATION_COUNT_LIMIT_EXCEEDED' } });
  });
});
