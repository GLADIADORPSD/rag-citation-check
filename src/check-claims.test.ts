import { describe, expect, it } from 'vitest';

import { STRUCTURED_CORPUS } from './__fixtures__/structured-corpus.js';
import { checkCitationClaims } from './check-claims.js';

describe('structured failure corpus F17-F27', () => {
  it.each(STRUCTURED_CORPUS)('$id', (fixture) => {
    const result = checkCitationClaims(fixture.input, fixture.options);

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.outcome).toBe(fixture.outcome);
      expect(result.report.assessments).toMatchObject({
        sourceCatalog: 'verified',
        citationSyntax: 'not-assessed',
        sourceReference: fixture.sourceReference,
        citationCoverage: fixture.citationCoverage,
        quotePresence: fixture.quotePresence,
        semanticSupport: 'not-assessed',
        sourceTrust: 'not-assessed',
        factualTruth: 'not-assessed',
      });
      expect(result.report.findings.map((finding) => finding.code)).toEqual(fixture.findingCodes);
      if (fixture.sourceRange !== undefined) {
        expect(result.report.quoteMatches).toEqual([
          expect.objectContaining({
            ambiguous: false,
            sourceRange: fixture.sourceRange,
          }),
        ]);
      }
    }
  });

  it('reports an ambiguous match separately from a unique range', () => {
    const result = checkCitationClaims(STRUCTURED_CORPUS[6]?.input ?? { claims: [], sources: [] });

    expect(result).toMatchObject({
      kind: 'completed',
      report: {
        quoteMatches: [
          {
            path: '$.claims[0].citations[0]',
            sourceId: 'doc',
            ambiguous: true,
          },
        ],
      },
    });
  });

  it('keeps coverage, reference, quote, and catalog assessments independent', () => {
    const result = checkCitationClaims({
      claims: [
        {
          id: 'required',
          text: 'Required claim',
          citationRequired: true,
          citations: [],
        },
        {
          id: 'quoted',
          text: 'Quoted claim',
          citations: [{ sourceId: 'missing', quote: 'evidence' }],
        },
      ],
      sources: [{ id: 'bad id' }],
    });

    expect(result).toMatchObject({
      kind: 'completed',
      report: {
        outcome: 'fail',
        assessments: {
          sourceCatalog: 'failed',
          citationSyntax: 'not-assessed',
          sourceReference: 'failed',
          citationCoverage: 'failed',
          quotePresence: 'failed',
          semanticSupport: 'not-assessed',
          sourceTrust: 'not-assessed',
          factualTruth: 'not-assessed',
        },
      },
    });
  });

  it('reports duplicates within one structured citation group', () => {
    const result = checkCitationClaims({
      claims: [
        {
          id: 'claim-1',
          text: 'Claim',
          citations: [{ sourceId: 'doc' }, { sourceId: 'doc' }],
        },
      ],
      sources: [{ id: 'doc' }],
    });

    expect(result).toMatchObject({
      kind: 'completed',
      report: {
        outcome: 'pass',
        findings: [{ code: 'CITATION_DUPLICATE_IN_GROUP', severity: 'warning' }],
      },
    });
  });

  it('does not mutate frozen structured input', () => {
    const citations = Object.freeze([Object.freeze({ sourceId: 'doc', quote: 'evidence' })]);
    const claims = Object.freeze([Object.freeze({ id: 'claim-1', text: 'Claim', citations })]);
    const sources = Object.freeze([Object.freeze({ id: 'doc', content: 'evidence' })]);
    const input = Object.freeze({ claims, sources });

    expect(checkCitationClaims(input)).toMatchObject({
      kind: 'completed',
      report: { outcome: 'pass' },
    });
    expect(input.claims).toBe(claims);
    expect(input.sources).toBe(sources);
  });

  it('rejects instead of returning a partial report when findings exceed the limit', () => {
    expect(
      checkCitationClaims(
        {
          claims: [{ id: 'claim-1', text: 'Claim', citations: [{ sourceId: 'missing' }] }],
          sources: [{ id: 'unused' }],
        },
        { limits: { findingCount: 1 } },
      ),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('serializes repeated reports identically', () => {
    const fixture = STRUCTURED_CORPUS[8];
    if (fixture === undefined) {
      throw new Error('F25 fixture is missing.');
    }
    const first = checkCitationClaims(fixture.input, fixture.options);
    const second = checkCitationClaims(fixture.input, fixture.options);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('propagates input, option, and catalog limit rejections', () => {
    expect(checkCitationClaims(null as never)).toMatchObject({
      kind: 'rejected',
      error: { code: 'INPUT_INVALID' },
    });
    expect(
      checkCitationClaims({ claims: [], sources: [] }, { quoteMatching: 'fuzzy' as never }),
    ).toMatchObject({ kind: 'rejected', error: { code: 'OPTION_INVALID' } });
    expect(
      checkCitationClaims(
        { claims: [], sources: [{ id: 'doc', content: 'é' }] },
        { limits: { sourceContentBytes: 1 } },
      ),
    ).toMatchObject({ kind: 'rejected', error: { code: 'SOURCE_CONTENT_LIMIT_EXCEEDED' } });
  });

  it('does not expose invalid structured source IDs in findings', () => {
    const result = checkCitationClaims({
      claims: [
        {
          id: 'claim-1',
          text: 'Claim',
          citations: [{ sourceId: 'bad id' }, { sourceId: 'bad id' }],
        },
      ],
      sources: [],
    });

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.findings).toHaveLength(3);
      expect(result.report.findings.every((finding) => finding.sourceId === undefined)).toBe(true);
    }
  });

  it('uses the first duplicate source deterministically and prepares it once', () => {
    const result = checkCitationClaims(
      {
        claims: [
          {
            id: 'claim-1',
            text: 'Claim',
            citations: [
              { sourceId: 'doc', quote: 'A B' },
              { sourceId: 'doc', quote: 'A B' },
            ],
          },
        ],
        sources: [
          { id: 'doc', content: 'A\r\nB' },
          { id: 'doc', content: 'different' },
        ],
      },
      { quoteMatching: 'normalized-whitespace' },
    );

    expect(result).toMatchObject({
      kind: 'completed',
      report: {
        assessments: { sourceCatalog: 'failed', quotePresence: 'verified' },
        quoteMatches: [
          { ambiguous: false, sourceRange: { start: 0, end: 4 } },
          { ambiguous: false, sourceRange: { start: 0, end: 4 } },
        ],
      },
    });
  });

  it('reports both an unknown source and an empty quote without echoing the source ID', () => {
    const result = checkCitationClaims({
      claims: [
        {
          id: 'claim-1',
          text: 'Claim',
          citations: [{ sourceId: 'bad id', quote: '' }],
        },
      ],
      sources: [],
    });

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.findings.map((finding) => finding.code)).toEqual([
        'CITATION_SOURCE_UNKNOWN',
        'QUOTE_EMPTY',
      ]);
      expect(result.report.findings.every((finding) => finding.sourceId === undefined)).toBe(true);
    }
  });
});
