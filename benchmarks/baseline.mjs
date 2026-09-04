import { performance } from 'node:perf_hooks';

import {
  checkCitationClaims,
  checkInlineCitations,
  HARD_LIMITS,
  parseInlineCitations,
} from '../dist/index.js';

const median = (values) => {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.floor(ordered.length / 2)];
};

const measure = (name, operation, iterations = 5) => {
  operation();
  const durations = [];
  const heapDeltas = [];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    globalThis.gc?.();
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const result = operation();
    durations.push(performance.now() - started);
    heapDeltas.push(Math.max(0, process.memoryUsage().heapUsed - heapBefore));
    if (result === undefined) {
      throw new Error(`${name} did not return a result.`);
    }
  }

  return {
    name,
    medianMilliseconds: Number(median(durations).toFixed(2)),
    medianHeapDeltaMiB: Number((median(heapDeltas) / 1024 / 1024).toFixed(2)),
  };
};

const inlineAnswer = '[1]'.repeat(Math.floor(HARD_LIMITS.answerBytes / 3));
const incompleteAnswer = '[1\n'.repeat(10_001);
const oneMiBSource = 'a'.repeat(HARD_LIMITS.sourceContentBytes);
const uniqueQuoteClaims = Array.from({ length: 100 }, (_, claimIndex) => ({
  id: `claim-${String(claimIndex)}`,
  text: 'Benchmark claim',
  citations: Array.from({ length: 100 }, (_, citationIndex) => ({
    sourceId: 'doc',
    quote: `missing-${String(claimIndex)}-${String(citationIndex)}`,
  })),
}));
const repeatedQuoteClaims = Array.from({ length: 100 }, (_, claimIndex) => ({
  id: `claim-${String(claimIndex)}`,
  text: 'Benchmark claim',
  citations: Array.from({ length: 100 }, () => ({ sourceId: 'doc', quote: 'a' })),
}));

const results = [
  measure('inline-max-citations', () =>
    checkInlineCitations({ answer: inlineAnswer, sources: [{ id: '1' }] }),
  ),
  measure('inline-finding-limit', () =>
    parseInlineCitations(incompleteAnswer, { limits: { findingCount: 10_000 } }),
  ),
  measure(
    'exact-10k-unique-misses-1mib-source',
    () =>
      checkCitationClaims({
        claims: uniqueQuoteClaims,
        sources: [{ id: 'doc', content: oneMiBSource }],
      }),
    3,
  ),
  measure(
    'normalized-10k-repeated-1mib-source',
    () =>
      checkCitationClaims(
        { claims: repeatedQuoteClaims, sources: [{ id: 'doc', content: oneMiBSource }] },
        { quoteMatching: 'normalized-whitespace' },
      ),
    3,
  ),
];

console.log(
  JSON.stringify(
    {
      runtime: process.version,
      platform: `${process.platform}-${process.arch}`,
      note: 'Local baseline only; not a performance guarantee.',
      results,
    },
    null,
    2,
  ),
);
