import { describe, expect, it } from 'vitest';

import { parseInlineCitations } from './inline-parser.js';

describe('inline citation parser', () => {
  it('parses numeric, named, and mixed groups with UTF-16 ranges', () => {
    const result = parseInlineCitations('😀 [1, @doc-a]');

    expect(result).toEqual({
      kind: 'completed',
      report: {
        schemaVersion: '1',
        outcome: 'pass',
        groups: [
          {
            answerRange: { start: 3, end: 14 },
            citations: [
              { sourceId: '1', answerRange: { start: 4, end: 5 } },
              { sourceId: 'doc-a', answerRange: { start: 7, end: 13 } },
            ],
          },
        ],
        findings: [],
        statistics: {
          groupCount: 1,
          citationCount: 2,
          findingCount: 0,
          errorCount: 0,
          warningCount: 0,
        },
      },
    });
  });

  it.each(['[@]', '[1,]', '[@doc-a,, @doc-b]', '[1a]', '[@bad/id]', `[@${'a'.repeat(65)}]`])(
    'reports malformed citation-like input: %s',
    (answer) => {
      expect(parseInlineCitations(answer)).toMatchObject({
        kind: 'completed',
        report: {
          outcome: 'fail',
          findings: [{ code: 'CITATION_MALFORMED', answerRange: { start: 0 } }],
        },
      });
    },
  );

  it('reports an unterminated group only through the line boundary', () => {
    const result = parseInlineCitations('Broken [1\nValid [2]');

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.groups).toHaveLength(1);
      expect(result.report.groups[0]?.citations[0]?.sourceId).toBe('2');
      expect(result.report.findings[0]?.answerRange).toEqual({ start: 7, end: 9 });
    }
  });

  it.each([
    '[1](https://example.test)',
    '![@doc-a]',
    '[^1]',
    '\\[1]',
    '`[1]`',
    '``code [1]``',
    '```ts\n[1]\n```',
    '~~~ts\n[1]\n~~~',
    '   ```ts\n[1]\n   ```',
  ])('ignores declared Markdown context: %s', (answer) => {
    expect(parseInlineCitations(answer)).toMatchObject({
      kind: 'completed',
      report: { groups: [], findings: [] },
    });
  });

  it('does not close a fence when the marker has a non-whitespace suffix', () => {
    expect(parseInlineCitations('```txt\n```not-a-close\n[1]\n```')).toMatchObject({
      kind: 'completed',
      report: { groups: [], findings: [] },
    });
  });

  it('does not treat an even number of backslashes as an escape', () => {
    expect(parseInlineCitations('\\\\[1]')).toMatchObject({
      kind: 'completed',
      report: { statistics: { citationCount: 1 } },
    });
  });

  it('ignores non-canonical named brackets', () => {
    expect(parseInlineCitations('[draft] [manual]')).toMatchObject({
      kind: 'completed',
      report: { outcome: 'pass', groups: [], findings: [] },
    });
  });

  it('reports each duplicate occurrence after the first in one group', () => {
    const result = parseInlineCitations('[1, 1, 1]');

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.report.outcome).toBe('pass');
      expect(result.report.findings).toHaveLength(2);
      expect(result.report.findings.map((finding) => finding.answerRange)).toEqual([
        { start: 4, end: 5 },
        { start: 7, end: 8 },
      ]);
    }
  });

  it('rejects a group above its citation count limit', () => {
    expect(parseInlineCitations('[1, 2]', { limits: { citationsPerClaim: 1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'CITATION_COUNT_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('rejects when parser findings exceed the configured limit', () => {
    expect(parseInlineCitations('[1,] [2,]', { limits: { findingCount: 1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });

  it('rejects invalid options, runtime input, and oversized answers', () => {
    expect(parseInlineCitations('', { limits: { answerBytes: -1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'OPTION_INVALID' },
    });
    expect(parseInlineCitations(null as never)).toMatchObject({
      kind: 'rejected',
      error: { code: 'INPUT_INVALID' },
    });
    expect(parseInlineCitations('é', { limits: { answerBytes: 1 } })).toMatchObject({
      kind: 'rejected',
      error: { code: 'ANSWER_LIMIT_EXCEEDED', actual: 2 },
    });
  });

  it('handles isolated surrogates and bracket-heavy input deterministically without crashing', () => {
    const answer = `${'['.repeat(10_000)}[1\ud800`;
    const first = parseInlineCitations(answer);
    const second = parseInlineCitations(answer);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: 'completed',
      report: { outcome: 'fail', statistics: { groupCount: 0, errorCount: 1 } },
    });
  });

  it('remains deterministic and returns in-bounds ranges for a seeded adversarial corpus', () => {
    let state = 0x5eed_1234;
    const alphabet = ['[', ']', '@', ',', '1', 'a', '_', '`', '~', '\\', '\n', ' ', '\ud800'];
    const next = (): number => {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      return state;
    };

    for (let caseIndex = 0; caseIndex < 1_000; caseIndex += 1) {
      const length = next() % 128;
      let answer = '';
      for (let index = 0; index < length; index += 1) {
        const character = alphabet[next() % alphabet.length];
        if (character === undefined) {
          throw new Error('Seeded corpus selected an invalid alphabet index.');
        }
        answer += character;
      }

      const first = parseInlineCitations(answer);
      expect(first).toEqual(parseInlineCitations(answer));
      if (first.kind === 'completed') {
        for (const group of first.report.groups) {
          expect(group.answerRange.start).toBeGreaterThanOrEqual(0);
          expect(group.answerRange.end).toBeLessThanOrEqual(answer.length);
          expect(group.answerRange.start).toBeLessThan(group.answerRange.end);
          expect(answer[group.answerRange.start]).toBe('[');
          expect(answer[group.answerRange.end - 1]).toBe(']');
          for (const citation of group.citations) {
            expect(citation.answerRange.start).toBeGreaterThan(group.answerRange.start);
            expect(citation.answerRange.end).toBeLessThan(group.answerRange.end);
            expect(citation.answerRange.start).toBeLessThan(citation.answerRange.end);
          }
        }
      }
    }
  });
});
