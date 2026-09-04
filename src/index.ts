export { checkCitationClaims } from './check-claims.js';
export { checkInlineCitations } from './check-inline.js';
export { parseInlineCitations } from './inline-parser.js';
export { DEFAULT_LIMITS, DEFAULT_QUOTE_MATCHING, HARD_LIMITS } from './limits.js';

export type {
  Assessment,
  CitationCheckInputError,
  CitationCheckInputErrorCode,
  CitationCheckLimits,
  CitationCheckOptions,
  CitationCheckReport,
  CitationCheckResult,
  CitationClaim,
  CitationClaimsInput,
  CitationFinding,
  CitationFindingCode,
  CitationFindingSeverity,
  CitationParseReport,
  CitationParseResult,
  CitationParseStatistics,
  CitationQuoteMatch,
  CitationReference,
  CitationSource,
  CitationStatistics,
  InlineCitationInput,
  ParsedInlineCitation,
  ParsedInlineCitationGroup,
  QuoteMatchMode,
  TextRange,
} from './contracts.js';
