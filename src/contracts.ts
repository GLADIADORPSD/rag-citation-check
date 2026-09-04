export type Assessment = 'verified' | 'failed' | 'not-assessed';

export type CitationSource = {
  readonly id: string;
  readonly content?: string;
};

export type InlineCitationInput = {
  readonly answer: string;
  readonly sources: readonly CitationSource[];
};

export type CitationReference = {
  readonly sourceId: string;
  readonly quote?: string;
};

export type CitationClaim = {
  readonly id: string;
  readonly text: string;
  readonly citationRequired?: boolean;
  readonly citations: readonly CitationReference[];
};

export type CitationClaimsInput = {
  readonly claims: readonly CitationClaim[];
  readonly sources: readonly CitationSource[];
};

export type QuoteMatchMode = 'exact' | 'normalized-whitespace';

export type CitationCheckLimits = {
  readonly answerBytes: number;
  readonly sourceCount: number;
  readonly sourceContentBytes: number;
  readonly totalSourceContentBytes: number;
  readonly claimCount: number;
  readonly citationsPerClaim: number;
  readonly findingCount: number;
  readonly sourceIdCharacters: number;
  readonly quoteBytes: number;
  readonly quoteCount: number;
};

export type CitationCheckOptions = {
  readonly limits?: Partial<CitationCheckLimits>;
  readonly quoteMatching?: QuoteMatchMode;
};

export type CitationFindingCode =
  | 'SOURCE_ID_INVALID'
  | 'SOURCE_ID_DUPLICATE'
  | 'CITATION_MALFORMED'
  | 'CITATION_SOURCE_UNKNOWN'
  | 'CITATION_DUPLICATE_IN_GROUP'
  | 'CLAIM_CITATION_REQUIRED'
  | 'QUOTE_EMPTY'
  | 'SOURCE_CONTENT_MISSING'
  | 'QUOTE_NOT_FOUND'
  | 'QUOTE_MATCH_AMBIGUOUS'
  | 'SOURCE_UNUSED';

export type CitationFindingSeverity = 'error' | 'warning' | 'info';

export type TextRange = {
  readonly start: number;
  readonly end: number;
};

export type CitationFinding = {
  readonly code: CitationFindingCode;
  readonly severity: CitationFindingSeverity;
  readonly message: string;
  readonly path?: string;
  readonly sourceId?: string;
  readonly claimId?: string;
  readonly answerRange?: TextRange;
  readonly sourceRange?: TextRange;
};

export type CitationStatistics = {
  readonly sourceCount: number;
  readonly claimCount: number;
  readonly citationCount: number;
  readonly findingCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
};

export type CitationQuoteMatch =
  | {
      readonly path: string;
      readonly sourceId?: string;
      readonly ambiguous: false;
      readonly sourceRange: TextRange;
    }
  | {
      readonly path: string;
      readonly sourceId?: string;
      readonly ambiguous: true;
    };

export type CitationCheckReport = {
  readonly schemaVersion: '1';
  readonly outcome: 'pass' | 'fail';
  readonly assessments: {
    readonly sourceCatalog: Assessment;
    readonly citationSyntax: Assessment;
    readonly sourceReference: Assessment;
    readonly citationCoverage: Assessment;
    readonly quotePresence: Assessment;
    readonly semanticSupport: 'not-assessed';
    readonly sourceTrust: 'not-assessed';
    readonly factualTruth: 'not-assessed';
  };
  readonly findings: readonly CitationFinding[];
  readonly quoteMatches: readonly CitationQuoteMatch[];
  readonly statistics: CitationStatistics;
};

export type CitationCheckInputErrorCode =
  | 'INPUT_INVALID'
  | 'OPTION_INVALID'
  | 'ANSWER_LIMIT_EXCEEDED'
  | 'SOURCE_COUNT_LIMIT_EXCEEDED'
  | 'SOURCE_CONTENT_LIMIT_EXCEEDED'
  | 'TOTAL_CONTENT_LIMIT_EXCEEDED'
  | 'CLAIM_COUNT_LIMIT_EXCEEDED'
  | 'CITATION_COUNT_LIMIT_EXCEEDED'
  | 'QUOTE_LIMIT_EXCEEDED'
  | 'QUOTE_COUNT_LIMIT_EXCEEDED'
  | 'FINDING_LIMIT_EXCEEDED';

export type CitationCheckInputError = {
  readonly code: CitationCheckInputErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly limit?: number;
  readonly actual?: number;
};

export type CitationCheckResult =
  | { readonly kind: 'completed'; readonly report: CitationCheckReport }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

export type ParsedInlineCitation = {
  readonly sourceId: string;
  readonly answerRange: TextRange;
};

export type ParsedInlineCitationGroup = {
  readonly answerRange: TextRange;
  readonly citations: readonly ParsedInlineCitation[];
};

export type CitationParseStatistics = {
  readonly groupCount: number;
  readonly citationCount: number;
  readonly findingCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
};

export type CitationParseReport = {
  readonly schemaVersion: '1';
  readonly outcome: 'pass' | 'fail';
  readonly groups: readonly ParsedInlineCitationGroup[];
  readonly findings: readonly CitationFinding[];
  readonly statistics: CitationParseStatistics;
};

export type CitationParseResult =
  | { readonly kind: 'completed'; readonly report: CitationParseReport }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };
