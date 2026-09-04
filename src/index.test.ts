import { describe, expect, it } from 'vitest';

import * as entrypoint from './index.js';

describe('package entrypoint', () => {
  it('loads as an ES module', () => {
    expect(entrypoint).toBeDefined();
  });
});
