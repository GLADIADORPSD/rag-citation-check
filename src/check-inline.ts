import type {
  Assessment,
  CitationCheckOptions,
  CitationCheckResult,
  CitationFinding,
  InlineCitationInput,
  ParsedInlineCitationGroup,
} from './contracts.js';
import { countFindings, sortFindings } from './findings.js';
import { scanInlineCitations } from './inline-parser.js';
import { limitError } from './limits.js';
import { buildSourceCatalog } from './source-catalog.js';
import { validateInlineInput } from './validation.js';

const syntaxAssessment = (
  groups: readonly ParsedInlineCitationGroup[],
  findings: readonly CitationFinding[],
): Assessment => {
  if (findings.some((finding) => finding.code === 'CITATION_MALFORMED')) {
    return 'failed';
  }
  return groups.length === 0 ? 'not-assessed' : 'verified';
};

const referenceAssessment = (
  citationCount: number,
  findings: readonly CitationFinding[],
): Assessment => {
  if (citationCount === 0) {
    return 'not-assessed';
  }
  return findings.some((finding) => finding.code === 'CITATION_SOURCE_UNKNOWN')
    ? 'failed'
    : 'verified';
};

export const checkInlineCitations = (
  input: InlineCitationInput,
  options?: CitationCheckOptions,
): CitationCheckResult => {
  const validated = validateInlineInput(input, options);
  if (validated.kind === 'rejected') {
    return validated;
  }

  const catalogResult = buildSourceCatalog(validated.value.input.sources, validated.value.limits);
  if (catalogResult.kind === 'rejected') {
    return catalogResult;
  }

  const scanned = scanInlineCitations(validated.value.input.answer, validated.value.limits);
  if (scanned.kind === 'rejected') {
    return scanned;
  }

  const findings: CitationFinding[] = [...catalogResult.catalog.findings, ...scanned.findings];
  let citationCount = 0;

  for (const group of scanned.groups) {
    for (const citation of group.citations) {
      citationCount += 1;
      if (catalogResult.catalog.sourcesById.has(citation.sourceId)) {
        continue;
      }

      if (findings.length >= validated.value.limits.findingCount) {
        return {
          kind: 'rejected',
          error: limitError({
            code: 'FINDING_LIMIT_EXCEEDED',
            path: '$.answer',
            limit: validated.value.limits.findingCount,
            actual: findings.length + 1,
          }),
        };
      }

      findings.push({
        code: 'CITATION_SOURCE_UNKNOWN',
        severity: 'error',
        message: 'Citation references a source ID that is absent from the supplied catalog.',
        path: '$.answer',
        sourceId: citation.sourceId,
        answerRange: citation.answerRange,
      });
    }
  }

  if (findings.length > validated.value.limits.findingCount) {
    return {
      kind: 'rejected',
      error: limitError({
        code: 'FINDING_LIMIT_EXCEEDED',
        path: '$',
        limit: validated.value.limits.findingCount,
        actual: findings.length,
      }),
    };
  }

  const orderedFindings = sortFindings(findings);
  const counts = countFindings(orderedFindings);

  return {
    kind: 'completed',
    report: {
      schemaVersion: '1',
      outcome: counts.error === 0 ? 'pass' : 'fail',
      assessments: {
        sourceCatalog: catalogResult.catalog.findings.some(
          (finding) => finding.severity === 'error',
        )
          ? 'failed'
          : 'verified',
        citationSyntax: syntaxAssessment(scanned.groups, orderedFindings),
        sourceReference: referenceAssessment(citationCount, orderedFindings),
        citationCoverage: 'not-assessed',
        quotePresence: 'not-assessed',
        semanticSupport: 'not-assessed',
        sourceTrust: 'not-assessed',
        factualTruth: 'not-assessed',
      },
      findings: orderedFindings,
      statistics: {
        sourceCount: validated.value.input.sources.length,
        claimCount: 0,
        citationCount,
        findingCount: orderedFindings.length,
        errorCount: counts.error,
        warningCount: counts.warning,
        infoCount: counts.info,
      },
    },
  };
};
