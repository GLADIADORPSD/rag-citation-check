export { checkInlineCitations } from './check-inline.js';
export { parseInlineCitations } from './inline-parser.js';
export { DEFAULT_LIMITS, HARD_LIMITS } from './limits.js';

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
  CitationReference,
  CitationSource,
  CitationStatistics,
  InlineCitationInput,
  ParsedInlineCitation,
  ParsedInlineCitationGroup,
  TextRange,
} from './contracts.js';
