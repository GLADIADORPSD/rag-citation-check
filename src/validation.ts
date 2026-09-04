import type {
  CitationCheckInputError,
  CitationCheckLimits,
  CitationClaimsInput,
  CitationSource,
  InlineCitationInput,
} from './contracts.js';
import { limitError, resolveOptions, utf8ByteLength } from './limits.js';

export type ValidatedInput<T> = {
  readonly input: T;
  readonly limits: Readonly<CitationCheckLimits>;
  readonly quoteMatching: 'exact' | 'normalized-whitespace';
};

export type InputValidationResult<T> =
  | { readonly kind: 'accepted'; readonly value: ValidatedInput<T> }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const inputError = (message: string, path: string): CitationCheckInputError => ({
  code: 'INPUT_INVALID',
  message,
  path,
});

const reject = <T>(error: CitationCheckInputError): InputValidationResult<T> => ({
  kind: 'rejected',
  error,
});

const validateSourceShapes = (sources: unknown): sources is readonly CitationSource[] => {
  if (!Array.isArray(sources)) {
    return false;
  }

  return sources.every((source) => {
    if (!isRecord(source)) {
      return false;
    }

    const id = source['id'];
    const content = source['content'];
    return typeof id === 'string' && (content === undefined || typeof content === 'string');
  });
};

const validateSources = <T>(
  sources: unknown,
  limits: Readonly<CitationCheckLimits>,
): InputValidationResult<T> | undefined => {
  if (!validateSourceShapes(sources)) {
    return reject(inputError('Sources must be an array of source objects.', '$.sources'));
  }

  if (sources.length > limits.sourceCount) {
    return reject(
      limitError({
        code: 'SOURCE_COUNT_LIMIT_EXCEEDED',
        path: '$.sources',
        limit: limits.sourceCount,
        actual: sources.length,
      }),
    );
  }

  return undefined;
};

export const validateInlineInput = (
  input: unknown,
  options?: unknown,
): InputValidationResult<InlineCitationInput> => {
  const resolved = resolveOptions(options);
  if (resolved.kind === 'rejected') {
    return reject(resolved.error);
  }

  if (!isRecord(input) || typeof input['answer'] !== 'string') {
    return reject(inputError('Inline input must contain a string answer.', '$.answer'));
  }

  const sourcesError = validateSources<InlineCitationInput>(input['sources'], resolved.limits);
  if (sourcesError !== undefined) {
    return sourcesError;
  }

  const answerBytes = utf8ByteLength(input['answer']);
  if (answerBytes > resolved.limits.answerBytes) {
    return reject(
      limitError({
        code: 'ANSWER_LIMIT_EXCEEDED',
        path: '$.answer',
        limit: resolved.limits.answerBytes,
        actual: answerBytes,
      }),
    );
  }

  return {
    kind: 'accepted',
    value: {
      input: input as InlineCitationInput,
      limits: resolved.limits,
      quoteMatching: resolved.quoteMatching,
    },
  };
};

export const validateClaimsInput = (
  input: unknown,
  options?: unknown,
): InputValidationResult<CitationClaimsInput> => {
  const resolved = resolveOptions(options);
  if (resolved.kind === 'rejected') {
    return reject(resolved.error);
  }

  if (!isRecord(input) || !Array.isArray(input['claims'])) {
    return reject(inputError('Structured input must contain a claims array.', '$.claims'));
  }

  const sourcesError = validateSources<CitationClaimsInput>(input['sources'], resolved.limits);
  if (sourcesError !== undefined) {
    return sourcesError;
  }

  const inputClaims = input['claims'];
  if (inputClaims.length > resolved.limits.claimCount) {
    return reject(
      limitError({
        code: 'CLAIM_COUNT_LIMIT_EXCEEDED',
        path: '$.claims',
        limit: resolved.limits.claimCount,
        actual: inputClaims.length,
      }),
    );
  }

  let quoteCount = 0;
  for (const [claimIndex, claim] of inputClaims.entries()) {
    const claimPath = `$.claims[${String(claimIndex)}]`;
    const claimId = isRecord(claim) ? claim['id'] : undefined;
    const claimText = isRecord(claim) ? claim['text'] : undefined;
    const citationRequired = isRecord(claim) ? claim['citationRequired'] : undefined;
    const citations = isRecord(claim) ? claim['citations'] : undefined;
    if (
      !isRecord(claim) ||
      typeof claimId !== 'string' ||
      typeof claimText !== 'string' ||
      (citationRequired !== undefined && typeof citationRequired !== 'boolean') ||
      !Array.isArray(citations)
    ) {
      return reject(inputError('Claim does not match the structured claim contract.', claimPath));
    }

    if (citations.length > resolved.limits.citationsPerClaim) {
      return reject(
        limitError({
          code: 'CITATION_COUNT_LIMIT_EXCEEDED',
          path: `${claimPath}.citations`,
          limit: resolved.limits.citationsPerClaim,
          actual: citations.length,
        }),
      );
    }

    for (const [citationIndex, citation] of citations.entries()) {
      const citationPath = `${claimPath}.citations[${String(citationIndex)}]`;
      const sourceId = isRecord(citation) ? citation['sourceId'] : undefined;
      const quote = isRecord(citation) ? citation['quote'] : undefined;
      if (
        !isRecord(citation) ||
        typeof sourceId !== 'string' ||
        (quote !== undefined && typeof quote !== 'string')
      ) {
        return reject(
          inputError('Citation does not match the structured citation contract.', citationPath),
        );
      }

      if (quote !== undefined) {
        quoteCount += 1;
        if (quoteCount > resolved.limits.quoteCount) {
          return reject(
            limitError({
              code: 'QUOTE_COUNT_LIMIT_EXCEEDED',
              path: '$.claims',
              limit: resolved.limits.quoteCount,
              actual: quoteCount,
            }),
          );
        }

        const quoteBytes = utf8ByteLength(quote);
        if (quoteBytes > resolved.limits.quoteBytes) {
          return reject(
            limitError({
              code: 'QUOTE_LIMIT_EXCEEDED',
              path: `${citationPath}.quote`,
              limit: resolved.limits.quoteBytes,
              actual: quoteBytes,
            }),
          );
        }
      }
    }
  }

  return {
    kind: 'accepted',
    value: {
      input: input as CitationClaimsInput,
      limits: resolved.limits,
      quoteMatching: resolved.quoteMatching,
    },
  };
};
