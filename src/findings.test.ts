import { describe, expect, it } from 'vitest';

import type { CitationFinding } from './contracts.js';
import { countFindings, sortFindings } from './findings.js';

describe('finding utilities', () => {
  it('orders by position, code, identifiers, and path using code-unit comparison', () => {
    const findings: CitationFinding[] = [
      { code: 'SOURCE_UNUSED', severity: 'info', message: 'd', path: 'z' },
      {
        code: 'CITATION_SOURCE_UNKNOWN',
        severity: 'error',
        message: 'c',
        sourceRange: { start: 2, end: 3 },
      },
      {
        code: 'CITATION_SOURCE_UNKNOWN',
        severity: 'error',
        message: 'b',
        sourceId: 'B',
        answerRange: { start: 1, end: 2 },
      },
      {
        code: 'CITATION_SOURCE_UNKNOWN',
        severity: 'error',
        message: 'a',
        sourceId: 'a',
        answerRange: { start: 1, end: 2 },
      },
    ];

    const ordered = sortFindings(findings);

    expect(ordered.map((finding) => finding.message)).toEqual(['b', 'a', 'c', 'd']);
    expect(Object.isFrozen(ordered)).toBe(true);
    expect(findings.map((finding) => finding.message)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('counts all public severities', () => {
    expect(
      countFindings([
        { code: 'CITATION_MALFORMED', severity: 'error', message: 'a' },
        { code: 'CITATION_DUPLICATE_IN_GROUP', severity: 'warning', message: 'b' },
        { code: 'SOURCE_UNUSED', severity: 'info', message: 'c' },
      ]),
    ).toEqual({ error: 1, warning: 1, info: 1 });
  });
});
