import { describe, expect, it } from 'vitest';

import { DEFAULT_LIMITS, HARD_LIMITS, resolveOptions, utf8ByteLength } from './limits.js';

describe('limit configuration', () => {
  it('uses immutable hard limits by default', () => {
    expect(resolveOptions(undefined)).toEqual({ kind: 'accepted', limits: HARD_LIMITS });
    expect(DEFAULT_LIMITS).toBe(HARD_LIMITS);
    expect(Object.isFrozen(HARD_LIMITS)).toBe(true);
  });

  it('accepts lower caller limits without mutating the defaults', () => {
    const result = resolveOptions({ limits: { answerBytes: 12, sourceCount: 2 } });

    expect(result).toEqual({
      kind: 'accepted',
      limits: { ...HARD_LIMITS, answerBytes: 12, sourceCount: 2 },
    });
    expect(result.kind === 'accepted' && Object.isFrozen(result.limits)).toBe(true);
    expect(HARD_LIMITS.answerBytes).toBe(128 * 1024);
  });

  it('accepts an options object without a limits override', () => {
    expect(resolveOptions({})).toEqual({ kind: 'accepted', limits: HARD_LIMITS });
    expect(resolveOptions({ limits: undefined })).toEqual({
      kind: 'accepted',
      limits: HARD_LIMITS,
    });
  });

  it.each([
    [null, '$options'],
    [[], '$options'],
    [{ unknown: true }, '$options.unknown'],
    [{ limits: null }, '$options.limits'],
    [{ limits: [] }, '$options.limits'],
    [{ limits: { unknown: 1 } }, '$options.limits.unknown'],
    [{ limits: { answerBytes: -1 } }, '$options.limits.answerBytes'],
    [{ limits: { answerBytes: 1.5 } }, '$options.limits.answerBytes'],
    [{ limits: { answerBytes: Number.MAX_SAFE_INTEGER + 1 } }, '$options.limits.answerBytes'],
    [{ limits: { answerBytes: HARD_LIMITS.answerBytes + 1 } }, '$options.limits.answerBytes'],
  ])('rejects invalid options %#', (options, path) => {
    expect(resolveOptions(options)).toMatchObject({
      kind: 'rejected',
      error: { code: 'OPTION_INVALID', path },
    });
  });

  it('measures UTF-8 bytes rather than UTF-16 code units', () => {
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength('é')).toBe(2);
    expect(utf8ByteLength('😀')).toBe(4);
  });
});
