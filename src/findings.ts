import type { CitationFinding, CitationFindingSeverity } from './contracts.js';

const rangeStart = (finding: CitationFinding): number =>
  finding.answerRange?.start ?? finding.sourceRange?.start ?? Number.MAX_SAFE_INTEGER;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const sortFindings = (findings: readonly CitationFinding[]): readonly CitationFinding[] =>
  Object.freeze(
    [...findings].sort(
      (left, right) =>
        rangeStart(left) - rangeStart(right) ||
        compareText(left.code, right.code) ||
        compareText(left.sourceId ?? '', right.sourceId ?? '') ||
        compareText(left.claimId ?? '', right.claimId ?? '') ||
        compareText(left.path ?? '', right.path ?? ''),
    ),
  );

export const countFindings = (
  findings: readonly CitationFinding[],
): Readonly<Record<CitationFindingSeverity, number>> => {
  const counts: Record<CitationFindingSeverity, number> = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) {
    counts[finding.severity] += 1;
  }
  return Object.freeze(counts);
};
