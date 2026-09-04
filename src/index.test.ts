import { describe, expect, it } from 'vitest';

import * as entrypoint from './index.js';
import {
  checkInlineCitations,
  DEFAULT_LIMITS,
  HARD_LIMITS,
  parseInlineCitations,
} from './index.js';

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

  it('exports the inline parser and checker', () => {
    expect(parseInlineCitations('[1]')).toMatchObject({
      kind: 'completed',
      report: { statistics: { citationCount: 1 } },
    });
    expect(checkInlineCitations({ answer: '[1]', sources: [{ id: '1' }] })).toMatchObject({
      kind: 'completed',
      report: { outcome: 'pass' },
    });
  });
});
