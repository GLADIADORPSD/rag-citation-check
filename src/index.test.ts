import { describe, expect, it } from 'vitest';

import * as entrypoint from './index.js';
import { DEFAULT_LIMITS, HARD_LIMITS } from './index.js';

describe('package entrypoint', () => {
  it('loads as an ES module', () => {
    expect(entrypoint).toBeDefined();
  });

  it('exports the documented limit constants', () => {
    expect(DEFAULT_LIMITS).toBe(HARD_LIMITS);
    expect(HARD_LIMITS).toMatchObject({
      answerBytes: 128 * 1024,
      sourceCount: 500,
      quoteBytes: 64 * 1024,
    });
  });
});
