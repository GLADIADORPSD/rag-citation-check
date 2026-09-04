# Performance baseline

This project uses hard input limits to bound work; it does not promise a fixed latency or memory
budget across machines, Node.js releases, or input distributions.

Run the reproducible local baseline with:

```bash
pnpm benchmark
```

The command builds the package and runs `benchmarks/baseline.mjs` with explicit garbage collection
between measured iterations. Heap deltas are directional measurements, not total process memory.

## Baseline recorded on 4 September 2026

- Node.js: 24.19.0
- Platform: Linux x64
- Values: median of five runs, except the two 10,000-quote cases, which use three

| Scenario                                                    |   Median | Median heap delta |
| ----------------------------------------------------------- | -------: | ----------------: |
| Inline answer near 128 KiB, about 43,000 valid citations    | 19.94 ms |         14.92 MiB |
| 10,001 incomplete groups, stopping at 10,000 findings       |  2.13 ms |          1.26 MiB |
| 10,000 unique exact misses against one 1 MiB source         | 69.26 ms |          8.03 MiB |
| 10,000 repeated normalized matches against one 1 MiB source | 71.03 ms |          7.34 MiB |

These cases intentionally exercise output volume, finding limits, repeated searching, normalization,
and source caching. Results should be re-recorded before a stable release and whenever parser,
normalization, limits, or supported Node.js lines change materially.
