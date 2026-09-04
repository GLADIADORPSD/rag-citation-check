import { describe, expect, it } from 'vitest';

import type { CitationCheckLimits, CitationSource } from './contracts.js';
import { HARD_LIMITS } from './limits.js';
import { buildSourceCatalog } from './source-catalog.js';

const limits = (overrides: Partial<CitationCheckLimits> = {}): CitationCheckLimits => ({
  ...HARD_LIMITS,
  ...overrides,
});

describe('source catalog', () => {
  it('builds an empty catalog', () => {
    const result = buildSourceCatalog([], limits());

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.catalog.sourcesById.size).toBe(0);
      expect(result.catalog.findings).toEqual([]);
      expect(Object.isFrozen(result.catalog.findings)).toBe(true);
    }
  });

  it('uses Map safely for prototype-like valid IDs', () => {
    const sources: CitationSource[] = [
      { id: '__proto__' },
      { id: 'constructor' },
      { id: 'prototype' },
    ];

    const result = buildSourceCatalog(sources, limits());

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.catalog.findings).toEqual([]);
      expect(result.catalog.sourcesById.get('__proto__')).toBe(sources[0]);
      expect(result.catalog.sourcesById.get('constructor')).toBe(sources[1]);
      expect(result.catalog.sourcesById.get('prototype')).toBe(sources[2]);
    }
    expect(Object.prototype).not.toHaveProperty('polluted');
  });

  it('reports invalid IDs without echoing hostile values', () => {
    const result = buildSourceCatalog(
      [{ id: '' }, { id: 'has space' }, { id: 'á' }, { id: 'a'.repeat(65) }],
      limits(),
    );

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.catalog.findings).toEqual(
        [0, 1, 2, 3].map((index) => ({
          code: 'SOURCE_ID_INVALID',
          severity: 'error',
          message: 'Source ID does not match the public ASCII identifier contract.',
          path: `$.sources[${String(index)}].id`,
        })),
      );
    }
  });

  it('reports each duplicate after the first declaration and keeps the first source', () => {
    const first = { id: 'doc-a', content: 'first' };
    const result = buildSourceCatalog(
      [first, { id: 'doc-a', content: 'second' }, { id: 'doc-a', content: 'third' }],
      limits(),
    );

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.catalog.sourcesById.get('doc-a')).toBe(first);
      expect(result.catalog.findings).toEqual([
        {
          code: 'SOURCE_ID_DUPLICATE',
          severity: 'error',
          message: 'Source ID is declared more than once.',
          path: '$.sources[1].id',
          sourceId: 'doc-a',
        },
        {
          code: 'SOURCE_ID_DUPLICATE',
          severity: 'error',
          message: 'Source ID is declared more than once.',
          path: '$.sources[2].id',
          sourceId: 'doc-a',
        },
      ]);
    }
  });

  it('does not expose an invalid duplicate ID in findings', () => {
    const result = buildSourceCatalog([{ id: 'bad id' }, { id: 'bad id' }], limits());

    expect(result.kind).toBe('completed');
    if (result.kind === 'completed') {
      expect(result.catalog.findings).toHaveLength(3);
      expect(result.catalog.findings[2]).toEqual({
        code: 'SOURCE_ID_DUPLICATE',
        severity: 'error',
        message: 'Source ID is declared more than once.',
        path: '$.sources[1].id',
      });
    }
  });

  it('accepts source content exactly at the byte limits', () => {
    const result = buildSourceCatalog(
      [
        { id: '1', content: 'é' },
        { id: '2', content: 'aa' },
      ],
      limits({ sourceContentBytes: 2, totalSourceContentBytes: 4 }),
    );

    expect(result.kind).toBe('completed');
  });

  it('rejects source content above the per-source byte limit', () => {
    expect(
      buildSourceCatalog([{ id: '1', content: 'é' }], limits({ sourceContentBytes: 1 })),
    ).toEqual({
      kind: 'rejected',
      error: {
        code: 'SOURCE_CONTENT_LIMIT_EXCEEDED',
        message: 'Input exceeds a configured safety limit.',
        path: '$.sources[0].content',
        limit: 1,
        actual: 2,
      },
    });
  });

  it('rejects cumulative content above the total byte limit', () => {
    expect(
      buildSourceCatalog(
        [
          { id: '1', content: 'aa' },
          { id: '2', content: 'bb' },
        ],
        limits({ sourceContentBytes: 2, totalSourceContentBytes: 3 }),
      ),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'TOTAL_CONTENT_LIMIT_EXCEEDED', path: '$.sources', limit: 3, actual: 4 },
    });
  });

  it('rejects instead of returning a partial catalog when findings exceed the limit', () => {
    expect(
      buildSourceCatalog([{ id: '' }, { id: 'bad id' }], limits({ findingCount: 1 })),
    ).toMatchObject({
      kind: 'rejected',
      error: { code: 'FINDING_LIMIT_EXCEEDED', limit: 1, actual: 2 },
    });
  });
});
