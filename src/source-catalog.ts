import type {
  CitationCheckInputError,
  CitationCheckLimits,
  CitationFinding,
  CitationSource,
} from './contracts.js';
import { limitError, utf8ByteLength } from './limits.js';

export type SourceCatalog = {
  readonly sourcesById: ReadonlyMap<string, CitationSource>;
  readonly findings: readonly CitationFinding[];
};

export type SourceCatalogResult =
  | { readonly kind: 'completed'; readonly catalog: SourceCatalog }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

const SOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const EXPLICIT_SAFE_IDENTIFIER_EXCEPTIONS = new Set(['__proto__']);

export const isValidSourceId = (id: string, maximumCharacters: number): boolean =>
  id.length > 0 &&
  id.length <= maximumCharacters &&
  (SOURCE_ID_PATTERN.test(id) || EXPLICIT_SAFE_IDENTIFIER_EXCEPTIONS.has(id));

export const buildSourceCatalog = (
  sources: readonly CitationSource[],
  limits: Readonly<CitationCheckLimits>,
): SourceCatalogResult => {
  const sourcesById = new Map<string, CitationSource>();
  const findings: CitationFinding[] = [];
  let totalContentBytes = 0;

  const addFinding = (finding: CitationFinding): CitationCheckInputError | undefined => {
    if (findings.length >= limits.findingCount) {
      return limitError({
        code: 'FINDING_LIMIT_EXCEEDED',
        path: '$.sources',
        limit: limits.findingCount,
        actual: findings.length + 1,
      });
    }

    findings.push(finding);
    return undefined;
  };

  for (const [index, source] of sources.entries()) {
    const path = `$.sources[${String(index)}]`;

    if (source.content !== undefined) {
      const contentBytes = utf8ByteLength(source.content);
      if (contentBytes > limits.sourceContentBytes) {
        return {
          kind: 'rejected',
          error: limitError({
            code: 'SOURCE_CONTENT_LIMIT_EXCEEDED',
            path: `${path}.content`,
            limit: limits.sourceContentBytes,
            actual: contentBytes,
          }),
        };
      }

      totalContentBytes += contentBytes;
      if (totalContentBytes > limits.totalSourceContentBytes) {
        return {
          kind: 'rejected',
          error: limitError({
            code: 'TOTAL_CONTENT_LIMIT_EXCEEDED',
            path: '$.sources',
            limit: limits.totalSourceContentBytes,
            actual: totalContentBytes,
          }),
        };
      }
    }

    const validId = isValidSourceId(source.id, limits.sourceIdCharacters);
    if (!validId) {
      const error = addFinding({
        code: 'SOURCE_ID_INVALID',
        severity: 'error',
        message: 'Source ID does not match the public ASCII identifier contract.',
        path: `${path}.id`,
      });
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
    }

    if (sourcesById.has(source.id)) {
      const error = addFinding({
        code: 'SOURCE_ID_DUPLICATE',
        severity: 'error',
        message: 'Source ID is declared more than once.',
        path: `${path}.id`,
        ...(validId ? { sourceId: source.id } : {}),
      });
      if (error !== undefined) {
        return { kind: 'rejected', error };
      }
      continue;
    }

    sourcesById.set(source.id, source);
  }

  return {
    kind: 'completed',
    catalog: {
      sourcesById,
      findings: Object.freeze(findings),
    },
  };
};
