import type {
  CitationCheckInputError,
  CitationCheckLimits,
  CitationCheckOptions,
  CitationFinding,
  CitationParseResult,
  ParsedInlineCitation,
  ParsedInlineCitationGroup,
} from './contracts.js';
import { countFindings, sortFindings } from './findings.js';
import { limitError } from './limits.js';
import { isValidSourceId } from './source-catalog.js';
import { validateInlineInput } from './validation.js';

type ScanResult =
  | {
      readonly kind: 'completed';
      readonly groups: readonly ParsedInlineCitationGroup[];
      readonly findings: readonly CitationFinding[];
    }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

type GroupParseResult =
  | { readonly kind: 'valid'; readonly citations: readonly ParsedInlineCitation[] }
  | { readonly kind: 'malformed' }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

const isAsciiDigit = (character: string | undefined): boolean =>
  character !== undefined && character >= '0' && character <= '9';

const isIdentifierCharacter = (character: string | undefined): boolean =>
  character !== undefined &&
  ((character >= 'A' && character <= 'Z') ||
    (character >= 'a' && character <= 'z') ||
    isAsciiDigit(character) ||
    character === '.' ||
    character === '_' ||
    character === ':' ||
    character === '-');

const isInlineSpace = (character: string | undefined): boolean =>
  character === ' ' || character === '\t';

const countRun = (answer: string, start: number, marker: string): number => {
  let cursor = start;
  while (answer[cursor] === marker) {
    cursor += 1;
  }
  return cursor - start;
};

const isAtFenceIndent = (answer: string, index: number): boolean => {
  let cursor = index - 1;
  let spaces = 0;
  while (cursor >= 0 && answer[cursor] !== '\n') {
    if (answer[cursor] !== ' ' || spaces === 3) {
      return false;
    }
    spaces += 1;
    cursor -= 1;
  }
  return true;
};

const skipLine = (answer: string, index: number): number => {
  const newline = answer.indexOf('\n', index);
  return newline === -1 ? answer.length : newline + 1;
};

const isFenceCloseSuffix = (answer: string, index: number): boolean => {
  let cursor = index;
  while (answer[cursor] === ' ' || answer[cursor] === '\t') {
    cursor += 1;
  }
  return cursor === answer.length || answer[cursor] === '\n' || answer[cursor] === '\r';
};

const skipFence = (answer: string, start: number, marker: string, openingRun: number): number => {
  let cursor = skipLine(answer, start + openingRun);

  while (cursor < answer.length) {
    let markerIndex = cursor;
    let spaces = 0;
    while (answer[markerIndex] === ' ' && spaces < 4) {
      spaces += 1;
      markerIndex += 1;
    }

    const closingRun = countRun(answer, markerIndex, marker);
    if (
      spaces <= 3 &&
      closingRun >= openingRun &&
      isFenceCloseSuffix(answer, markerIndex + closingRun)
    ) {
      return skipLine(answer, markerIndex + closingRun);
    }

    cursor = skipLine(answer, cursor);
  }

  return answer.length;
};

const skipInlineCode = (answer: string, start: number, openingRun: number): number => {
  let cursor = start + openingRun;
  while (cursor < answer.length) {
    if (answer[cursor] !== '`') {
      cursor += 1;
      continue;
    }

    const run = countRun(answer, cursor, '`');
    if (run === openingRun) {
      return cursor + run;
    }
    cursor += run;
  }
  return answer.length;
};

const isEscaped = (answer: string, index: number): boolean => {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && answer[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
};

const findCandidateEnd = (answer: string, start: number): number => {
  for (let cursor = start; cursor < answer.length; cursor += 1) {
    const character = answer[cursor];
    if (character === ']') {
      return cursor;
    }
    if (character === '\n' || character === '\r') {
      return -cursor - 1;
    }
  }
  return -answer.length - 1;
};

const parseGroup = (
  answer: string,
  contentStart: number,
  contentEnd: number,
  limits: Readonly<CitationCheckLimits>,
): GroupParseResult => {
  const citations: ParsedInlineCitation[] = [];
  let cursor = contentStart;

  while (cursor < contentEnd) {
    const referenceStart = cursor;
    const named = answer[cursor] === '@';
    if (named) {
      cursor += 1;
    }

    const sourceIdStart = cursor;
    if (named) {
      while (cursor < contentEnd && isIdentifierCharacter(answer[cursor])) {
        cursor += 1;
      }
    } else {
      while (cursor < contentEnd && isAsciiDigit(answer[cursor])) {
        cursor += 1;
      }
    }

    const sourceId = answer.slice(sourceIdStart, cursor);
    if (sourceId.length === 0 || !isValidSourceId(sourceId, limits.sourceIdCharacters)) {
      return { kind: 'malformed' };
    }

    citations.push({
      sourceId,
      answerRange: { start: referenceStart, end: cursor },
    });
    if (citations.length > limits.citationsPerClaim) {
      return {
        kind: 'rejected',
        error: limitError({
          code: 'CITATION_COUNT_LIMIT_EXCEEDED',
          path: '$.answer',
          limit: limits.citationsPerClaim,
          actual: citations.length,
        }),
      };
    }

    while (cursor < contentEnd && isInlineSpace(answer[cursor])) {
      cursor += 1;
    }
    if (cursor === contentEnd) {
      break;
    }
    if (answer[cursor] !== ',') {
      return { kind: 'malformed' };
    }

    cursor += 1;
    while (cursor < contentEnd && isInlineSpace(answer[cursor])) {
      cursor += 1;
    }
    if (cursor === contentEnd || (answer[cursor] !== '@' && !isAsciiDigit(answer[cursor]))) {
      return { kind: 'malformed' };
    }
  }

  return citations.length === 0 ? { kind: 'malformed' } : { kind: 'valid', citations };
};

const malformedFinding = (start: number, end: number): CitationFinding => ({
  code: 'CITATION_MALFORMED',
  severity: 'error',
  message: 'Citation-like markup does not match the public inline grammar.',
  path: '$.answer',
  answerRange: { start, end },
});

export const scanInlineCitations = (
  answer: string,
  limits: Readonly<CitationCheckLimits>,
): ScanResult => {
  const groups: ParsedInlineCitationGroup[] = [];
  const findings: CitationFinding[] = [];
  let cursor = 0;

  const addFinding = (finding: CitationFinding): CitationCheckInputError | undefined => {
    if (findings.length >= limits.findingCount) {
      return limitError({
        code: 'FINDING_LIMIT_EXCEEDED',
        path: '$.answer',
        limit: limits.findingCount,
        actual: findings.length + 1,
      });
    }
    findings.push(finding);
    return undefined;
  };

  while (cursor < answer.length) {
    const character = answer[cursor];
    if ((character === '`' || character === '~') && isAtFenceIndent(answer, cursor)) {
      const run = countRun(answer, cursor, character);
      if (run >= 3) {
        cursor = skipFence(answer, cursor, character, run);
        continue;
      }
    }

    if (character === '`') {
      const run = countRun(answer, cursor, '`');
      cursor = skipInlineCode(answer, cursor, run);
      continue;
    }

    if (
      character !== '[' ||
      isEscaped(answer, cursor) ||
      answer[cursor - 1] === '!' ||
      answer[cursor + 1] === '^' ||
      (answer[cursor + 1] !== '@' && !isAsciiDigit(answer[cursor + 1]))
    ) {
      cursor += 1;
      continue;
    }

    const candidateEnd = findCandidateEnd(answer, cursor + 1);
    if (candidateEnd < 0) {
      const end = -candidateEnd - 1;
      const error = addFinding(malformedFinding(cursor, end));
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
      cursor = end === cursor ? cursor + 1 : end;
      continue;
    }

    if (answer[candidateEnd + 1] === '(') {
      cursor = candidateEnd + 1;
      continue;
    }

    const parsed = parseGroup(answer, cursor + 1, candidateEnd, limits);
    if (parsed.kind === 'rejected') {
      return parsed;
    }
    if (parsed.kind === 'malformed') {
      const error = addFinding(malformedFinding(cursor, candidateEnd + 1));
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
      cursor = candidateEnd + 1;
      continue;
    }

    const group: ParsedInlineCitationGroup = {
      answerRange: { start: cursor, end: candidateEnd + 1 },
      citations: Object.freeze([...parsed.citations]),
    };
    groups.push(group);

    const seen = new Set<string>();
    for (const citation of parsed.citations) {
      if (seen.has(citation.sourceId)) {
        const error = addFinding({
          code: 'CITATION_DUPLICATE_IN_GROUP',
          severity: 'warning',
          message: 'Source ID appears more than once in the same citation group.',
          path: '$.answer',
          sourceId: citation.sourceId,
          answerRange: citation.answerRange,
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
      } else {
        seen.add(citation.sourceId);
      }
    }

    cursor = candidateEnd + 1;
  }

  return {
    kind: 'completed',
    groups: Object.freeze(groups),
    findings: sortFindings(findings),
  };
};

export const parseInlineCitations = (
  answer: string,
  options?: CitationCheckOptions,
): CitationParseResult => {
  const validated = validateInlineInput({ answer, sources: [] }, options);
  if (validated.kind === 'rejected') {
    return validated;
  }

  const scanned = scanInlineCitations(answer, validated.value.limits);
  if (scanned.kind === 'rejected') {
    return scanned;
  }

  const findings = sortFindings(scanned.findings);
  const counts = countFindings(findings);
  const citationCount = scanned.groups.reduce((total, group) => total + group.citations.length, 0);

  return {
    kind: 'completed',
    report: {
      schemaVersion: '1',
      outcome: counts.error === 0 ? 'pass' : 'fail',
      groups: scanned.groups,
      findings,
      statistics: {
        groupCount: scanned.groups.length,
        citationCount,
        findingCount: findings.length,
        errorCount: counts.error,
        warningCount: counts.warning,
      },
    },
  };
};
