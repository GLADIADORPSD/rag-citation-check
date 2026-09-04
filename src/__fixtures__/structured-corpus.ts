import type {
  Assessment,
  CitationCheckOptions,
  CitationClaimsInput,
  CitationFindingCode,
  TextRange,
} from '../contracts.js';

export type StructuredCorpusCase = {
  readonly id: `F${string}`;
  readonly input: CitationClaimsInput;
  readonly options?: CitationCheckOptions;
  readonly outcome: 'pass' | 'fail';
  readonly sourceReference: Assessment;
  readonly citationCoverage: Assessment;
  readonly quotePresence: Assessment;
  readonly findingCodes: readonly CitationFindingCode[];
  readonly sourceRange?: TextRange;
};

const claim = (
  citations: CitationClaimsInput['claims'][number]['citations'],
  citationRequired = false,
): CitationClaimsInput['claims'][number] => ({
  id: 'claim-1',
  text: 'A claim supplied by the caller.',
  citationRequired,
  citations,
});

export const STRUCTURED_CORPUS: readonly StructuredCorpusCase[] = [
  {
    id: 'F17',
    input: { claims: [claim([], true)], sources: [] },
    outcome: 'fail',
    sourceReference: 'not-assessed',
    citationCoverage: 'failed',
    quotePresence: 'not-assessed',
    findingCodes: ['CLAIM_CITATION_REQUIRED'],
  },
  {
    id: 'F18',
    input: { claims: [claim([])], sources: [] },
    outcome: 'pass',
    sourceReference: 'not-assessed',
    citationCoverage: 'verified',
    quotePresence: 'not-assessed',
    findingCodes: [],
  },
  {
    id: 'F19',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'evidence' }])],
      sources: [{ id: 'doc', content: 'Before evidence after.' }],
    },
    outcome: 'pass',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'verified',
    findingCodes: [],
    sourceRange: { start: 7, end: 15 },
  },
  {
    id: 'F20',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'absent' }])],
      sources: [{ id: 'doc', content: 'Available evidence.' }],
    },
    outcome: 'fail',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'failed',
    findingCodes: ['QUOTE_NOT_FOUND'],
  },
  {
    id: 'F21',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'evidence' }])],
      sources: [{ id: 'doc' }],
    },
    outcome: 'fail',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'failed',
    findingCodes: ['SOURCE_CONTENT_MISSING'],
  },
  {
    id: 'F22',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: ' \t\n' }])],
      sources: [{ id: 'doc', content: ' \t\n' }],
    },
    outcome: 'fail',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'failed',
    findingCodes: ['QUOTE_EMPTY'],
  },
  {
    id: 'F23',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'same' }])],
      sources: [{ id: 'doc', content: 'same and same' }],
    },
    outcome: 'pass',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'verified',
    findingCodes: ['QUOTE_MATCH_AMBIGUOUS'],
  },
  {
    id: 'F24',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'A\nB' }])],
      sources: [{ id: 'doc', content: 'Before A\r\nB after.' }],
    },
    outcome: 'fail',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'failed',
    findingCodes: ['QUOTE_NOT_FOUND'],
  },
  {
    id: 'F25',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'A\nB' }])],
      sources: [{ id: 'doc', content: 'Before A\r\nB after.' }],
    },
    options: { quoteMatching: 'normalized-whitespace' },
    outcome: 'pass',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'verified',
    findingCodes: [],
    sourceRange: { start: 7, end: 11 },
  },
  {
    id: 'F26',
    input: {
      claims: [claim([{ sourceId: 'doc', quote: 'Evidence' }])],
      sources: [{ id: 'doc', content: 'evidence' }],
    },
    options: { quoteMatching: 'normalized-whitespace' },
    outcome: 'fail',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'failed',
    findingCodes: ['QUOTE_NOT_FOUND'],
  },
  {
    id: 'F27',
    input: {
      claims: [claim([{ sourceId: 'used' }])],
      sources: [{ id: 'used' }, { id: 'unused' }],
    },
    outcome: 'pass',
    sourceReference: 'verified',
    citationCoverage: 'verified',
    quotePresence: 'not-assessed',
    findingCodes: ['SOURCE_UNUSED'],
  },
];
