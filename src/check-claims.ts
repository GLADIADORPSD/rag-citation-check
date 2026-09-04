import type {
  Assessment,
  CitationCheckInputError,
  CitationCheckOptions,
  CitationCheckResult,
  CitationClaimsInput,
  CitationFinding,
  CitationQuoteMatch,
} from './contracts.js';
import { countFindings, sortFindings } from './findings.js';
import { limitError } from './limits.js';
import {
  matchQuote,
  prepareQuoteSource,
  type PreparedQuoteSource,
  type QuoteMatchResult,
} from './quote-matcher.js';
import { buildSourceCatalog, isValidSourceId } from './source-catalog.js';
import { validateClaimsInput } from './validation.js';

const assessment = (applicable: boolean, failed: boolean): Assessment =>
  applicable ? (failed ? 'failed' : 'verified') : 'not-assessed';

export const checkCitationClaims = (
  input: CitationClaimsInput,
  options?: CitationCheckOptions,
): CitationCheckResult => {
  const validated = validateClaimsInput(input, options);
  if (validated.kind === 'rejected') {
    return validated;
  }

  const { limits, quoteMatching } = validated.value;
  const claims = validated.value.input.claims;
  const sources = validated.value.input.sources;
  const catalogResult = buildSourceCatalog(sources, limits);
  if (catalogResult.kind === 'rejected') {
    return catalogResult;
  }

  const findings: CitationFinding[] = [...catalogResult.catalog.findings];
  const quoteMatches: CitationQuoteMatch[] = [];
  const referencedSourceIds = new Set<string>();
  const preparedSources = new Map<string, PreparedQuoteSource>();
  const matchCache = new Map<string, Map<string, QuoteMatchResult>>();
  let citationCount = 0;
  let coverageFailed = false;
  let quoteApplicable = false;
  let quoteFailed = false;

  const addFinding = (finding: CitationFinding): CitationCheckInputError | undefined => {
    if (findings.length >= limits.findingCount) {
      return limitError({
        code: 'FINDING_LIMIT_EXCEEDED',
        path: finding.path ?? '$',
        limit: limits.findingCount,
        actual: findings.length + 1,
      });
    }
    findings.push(finding);
    return undefined;
  };

  for (const [claimIndex, claim] of claims.entries()) {
    const claimPath = `$.claims[${String(claimIndex)}]`;
    if (claim.citationRequired === true && claim.citations.length === 0) {
      coverageFailed = true;
      const error = addFinding({
        code: 'CLAIM_CITATION_REQUIRED',
        severity: 'error',
        message: 'Claim requires at least one citation.',
        path: `${claimPath}.citations`,
      });
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
    }

    const seenSourceIds = new Set<string>();
    for (const [citationIndex, citation] of claim.citations.entries()) {
      citationCount += 1;
      referencedSourceIds.add(citation.sourceId);
      const citationPath = `${claimPath}.citations[${String(citationIndex)}]`;

      if (seenSourceIds.has(citation.sourceId)) {
        const error = addFinding({
          code: 'CITATION_DUPLICATE_IN_GROUP',
          severity: 'warning',
          message: 'Source ID appears more than once in the same claim citation group.',
          path: citationPath,
          ...(isValidSourceId(citation.sourceId, limits.sourceIdCharacters)
            ? { sourceId: citation.sourceId }
            : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
      } else {
        seenSourceIds.add(citation.sourceId);
      }

      const source = catalogResult.catalog.sourcesById.get(citation.sourceId);
      if (source === undefined) {
        const error = addFinding({
          code: 'CITATION_SOURCE_UNKNOWN',
          severity: 'error',
          message: 'Citation references a source ID that is absent from the supplied catalog.',
          path: `${citationPath}.sourceId`,
          ...(isValidSourceId(citation.sourceId, limits.sourceIdCharacters)
            ? { sourceId: citation.sourceId }
            : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
      }

      if (citation.quote === undefined) {
        continue;
      }
      quoteApplicable = true;

      if (citation.quote.length === 0 || /^\s+$/u.test(citation.quote)) {
        quoteFailed = true;
        const error = addFinding({
          code: 'QUOTE_EMPTY',
          severity: 'error',
          message: 'Quote must contain at least one non-whitespace character.',
          path: `${citationPath}.quote`,
          ...(source !== undefined && isValidSourceId(source.id, limits.sourceIdCharacters)
            ? { sourceId: source.id }
            : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
        continue;
      }

      if (source === undefined) {
        quoteFailed = true;
        continue;
      }

      if (source.content === undefined) {
        quoteFailed = true;
        const error = addFinding({
          code: 'SOURCE_CONTENT_MISSING',
          severity: 'error',
          message: 'Citation supplies a quote, but the referenced source has no content.',
          path: `${citationPath}.quote`,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
        continue;
      }

      let prepared = preparedSources.get(source.id);
      if (prepared === undefined) {
        prepared = prepareQuoteSource(source.content, quoteMatching);
        preparedSources.set(source.id, prepared);
      }
      let sourceMatches = matchCache.get(source.id);
      if (sourceMatches === undefined) {
        sourceMatches = new Map<string, QuoteMatchResult>();
        matchCache.set(source.id, sourceMatches);
      }
      let match = sourceMatches.get(citation.quote);
      if (match === undefined) {
        match = matchQuote(prepared, citation.quote);
        sourceMatches.set(citation.quote, match);
      }

      if (match.kind === 'empty') {
        quoteFailed = true;
        const error = addFinding({
          code: 'QUOTE_EMPTY',
          severity: 'error',
          message: 'Quote must contain at least one non-whitespace character.',
          path: `${citationPath}.quote`,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
        continue;
      }

      if (match.kind === 'not-found') {
        quoteFailed = true;
        const error = addFinding({
          code: 'QUOTE_NOT_FOUND',
          severity: 'error',
          message: 'Quote does not occur in the referenced source under the configured mode.',
          path: `${citationPath}.quote`,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
        continue;
      }

      if (match.ambiguous) {
        quoteMatches.push({
          path: citationPath,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
          ambiguous: true,
        });
        const error = addFinding({
          code: 'QUOTE_MATCH_AMBIGUOUS',
          severity: 'warning',
          message:
            'Quote occurs more than once; presence is confirmed but its position is ambiguous.',
          path: `${citationPath}.quote`,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
        });
        if (error !== undefined) {
          return { kind: 'rejected', error };
        }
      } else {
        quoteMatches.push({
          path: citationPath,
          ...(isValidSourceId(source.id, limits.sourceIdCharacters) ? { sourceId: source.id } : {}),
          ambiguous: false,
          sourceRange: match.sourceRange,
        });
      }
    }
  }

  const encounteredSources = new Set<string>();
  for (const [sourceIndex, source] of sources.entries()) {
    if (encounteredSources.has(source.id)) {
      continue;
    }
    encounteredSources.add(source.id);
    if (
      !referencedSourceIds.has(source.id) &&
      isValidSourceId(source.id, limits.sourceIdCharacters)
    ) {
      const error = addFinding({
        code: 'SOURCE_UNUSED',
        severity: 'info',
        message: 'Source is present in the catalog but is not referenced by any claim.',
        path: `$.sources[${String(sourceIndex)}]`,
        sourceId: source.id,
      });
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
    }
  }

  const orderedFindings = sortFindings(findings);
  const counts = countFindings(orderedFindings);
  const sourceReferenceFailed = orderedFindings.some(
    (finding) => finding.code === 'CITATION_SOURCE_UNKNOWN',
  );

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
        citationSyntax: 'not-assessed',
        sourceReference: assessment(citationCount > 0, sourceReferenceFailed),
        citationCoverage: assessment(claims.length > 0, coverageFailed),
        quotePresence: assessment(quoteApplicable, quoteFailed),
        semanticSupport: 'not-assessed',
        sourceTrust: 'not-assessed',
        factualTruth: 'not-assessed',
      },
      findings: orderedFindings,
      quoteMatches: Object.freeze(quoteMatches),
      statistics: {
        sourceCount: sources.length,
        claimCount: claims.length,
        citationCount,
        findingCount: orderedFindings.length,
        errorCount: counts.error,
        warningCount: counts.warning,
        infoCount: counts.info,
      },
    },
  };
};
