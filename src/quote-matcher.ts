import type { QuoteMatchMode, TextRange } from './contracts.js';

export type QuoteMatchResult =
  | { readonly kind: 'empty' }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'matched'; readonly ambiguous: false; readonly sourceRange: TextRange }
  | { readonly kind: 'matched'; readonly ambiguous: true };

type NormalizedText = {
  readonly value: string;
  readonly originalStarts: Uint32Array;
  readonly originalEnds: Uint32Array;
};

export type PreparedQuoteSource =
  | { readonly mode: 'exact'; readonly value: string }
  | { readonly mode: 'normalized-whitespace'; readonly value: NormalizedText };

const MARK_PATTERN = /^\p{M}$/u;
const WHITESPACE_PATTERN = /^\s$/u;

const codePointEnd = (value: string, start: number): number => {
  const first = value.charCodeAt(start);
  return first >= 0xd800 && first <= 0xdbff && value.charCodeAt(start + 1) >= 0xdc00
    ? start + 2
    : start + 1;
};

const codePointAt = (value: string, start: number): number => value.codePointAt(start) ?? 0;

const mappedValue = (map: Uint32Array, index: number): number => map[index] ?? 0;

const isHangulLeadingJamo = (codePoint: number): boolean =>
  (codePoint >= 0x1100 && codePoint <= 0x1112) || (codePoint >= 0xa960 && codePoint <= 0xa97c);

const isHangulVowelJamo = (codePoint: number): boolean =>
  (codePoint >= 0x1161 && codePoint <= 0x1175) || (codePoint >= 0xd7b0 && codePoint <= 0xd7c6);

const isHangulTrailingJamo = (codePoint: number): boolean =>
  (codePoint >= 0x11a8 && codePoint <= 0x11c2) || (codePoint >= 0xd7cb && codePoint <= 0xd7fb);

const isHangulLvSyllable = (codePoint: number): boolean =>
  codePoint >= 0xac00 && codePoint <= 0xd7a3 && (codePoint - 0xac00) % 28 === 0;

const normalizationSegmentEnd = (value: string, start: number): number => {
  let end = codePointEnd(value, start);
  const first = codePointAt(value, start);

  if (
    isHangulLeadingJamo(first) &&
    end < value.length &&
    isHangulVowelJamo(codePointAt(value, end))
  ) {
    end = codePointEnd(value, end);
    if (end < value.length && isHangulTrailingJamo(codePointAt(value, end))) {
      end = codePointEnd(value, end);
    }
  } else if (
    isHangulLvSyllable(first) &&
    end < value.length &&
    isHangulTrailingJamo(codePointAt(value, end))
  ) {
    end = codePointEnd(value, end);
  }

  while (end < value.length) {
    const nextEnd = codePointEnd(value, end);
    if (!MARK_PATTERN.test(value.slice(end, nextEnd))) {
      break;
    }
    end = nextEnd;
  }

  return end;
};

class RangeMapBuilder {
  private starts: Uint32Array;
  private ends: Uint32Array;
  private length = 0;

  public constructor(initialCapacity: number) {
    const capacity = Math.max(initialCapacity, 1);
    this.starts = new Uint32Array(capacity);
    this.ends = new Uint32Array(capacity);
  }

  public append(repetitions: number, start: number, end: number): void {
    this.ensureCapacity(this.length + repetitions);
    this.starts.fill(start, this.length, this.length + repetitions);
    this.ends.fill(end, this.length, this.length + repetitions);
    this.length += repetitions;
  }

  public finishStarts(): Uint32Array {
    return this.starts.slice(0, this.length);
  }

  public finishEnds(): Uint32Array {
    return this.ends.slice(0, this.length);
  }

  private ensureCapacity(required: number): void {
    if (required <= this.starts.length) {
      return;
    }

    let capacity = this.starts.length;
    while (capacity < required) {
      capacity *= 2;
    }

    const starts = new Uint32Array(capacity);
    const ends = new Uint32Array(capacity);
    starts.set(this.starts);
    ends.set(this.ends);
    this.starts = starts;
    this.ends = ends;
  }
}

const normalizeNfcWithMap = (value: string): NormalizedText => {
  const wholeValue = value.normalize('NFC');
  if (wholeValue === value) {
    const originalStarts = new Uint32Array(value.length);
    const originalEnds = new Uint32Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      originalStarts[index] = index;
      originalEnds[index] = index + 1;
    }
    return { value, originalStarts, originalEnds };
  }

  const pieces: string[] = [];
  const map = new RangeMapBuilder(value.length);

  for (let start = 0; start < value.length;) {
    const end = normalizationSegmentEnd(value, start);
    const normalized = value.slice(start, end).normalize('NFC');
    pieces.push(normalized);
    map.append(normalized.length, start, end);
    start = end;
  }

  return {
    value: pieces.join(''),
    originalStarts: map.finishStarts(),
    originalEnds: map.finishEnds(),
  };
};

const normalizeWhitespaceWithMap = (value: string): NormalizedText => {
  const nfc = normalizeNfcWithMap(value);
  const pieces: string[] = [];
  const map = new RangeMapBuilder(nfc.value.length);
  let hasOutput = false;
  let pendingWhitespaceStart: number | undefined;
  let pendingWhitespaceEnd = 0;
  let cursor = 0;

  while (cursor < nfc.value.length) {
    if (WHITESPACE_PATTERN.test(nfc.value[cursor] ?? '')) {
      pendingWhitespaceStart ??= mappedValue(nfc.originalStarts, cursor);
      pendingWhitespaceEnd = mappedValue(nfc.originalEnds, cursor);
      cursor += 1;
      continue;
    }

    if (hasOutput && pendingWhitespaceStart !== undefined) {
      pieces.push(' ');
      map.append(1, pendingWhitespaceStart, pendingWhitespaceEnd);
    }
    pendingWhitespaceStart = undefined;

    const runStart = cursor;
    while (cursor < nfc.value.length && !WHITESPACE_PATTERN.test(nfc.value[cursor] ?? '')) {
      cursor += 1;
    }
    pieces.push(nfc.value.slice(runStart, cursor));
    for (let index = runStart; index < cursor; index += 1) {
      map.append(1, mappedValue(nfc.originalStarts, index), mappedValue(nfc.originalEnds, index));
    }
    hasOutput = true;
  }

  return {
    value: pieces.join(''),
    originalStarts: map.finishStarts(),
    originalEnds: map.finishEnds(),
  };
};

const isWhitespaceOnly = (value: string): boolean => value.length === 0 || /^\s+$/u.test(value);

const findOccurrences = (haystack: string, needle: string): readonly [number, number] => {
  const first = haystack.indexOf(needle);
  const second = first === -1 ? -1 : haystack.indexOf(needle, first + 1);
  return [first, second];
};

export const prepareQuoteSource = (
  sourceContent: string,
  mode: QuoteMatchMode,
): PreparedQuoteSource =>
  mode === 'exact'
    ? { mode, value: sourceContent }
    : { mode, value: normalizeWhitespaceWithMap(sourceContent) };

export const matchQuote = (source: PreparedQuoteSource, quote: string): QuoteMatchResult => {
  if (isWhitespaceOnly(quote)) {
    return { kind: 'empty' };
  }

  if (source.mode === 'exact') {
    const [first, second] = findOccurrences(source.value, quote);
    if (first === -1) {
      return { kind: 'not-found' };
    }
    return second === -1
      ? {
          kind: 'matched',
          ambiguous: false,
          sourceRange: { start: first, end: first + quote.length },
        }
      : { kind: 'matched', ambiguous: true };
  }

  const normalizedSource = source.value;
  const normalizedQuote = normalizeWhitespaceWithMap(quote).value;
  const [first, second] = findOccurrences(normalizedSource.value, normalizedQuote);
  if (first === -1) {
    return { kind: 'not-found' };
  }
  if (second !== -1) {
    return { kind: 'matched', ambiguous: true };
  }

  const last = first + normalizedQuote.length - 1;
  return {
    kind: 'matched',
    ambiguous: false,
    sourceRange: {
      start: mappedValue(normalizedSource.originalStarts, first),
      end: mappedValue(normalizedSource.originalEnds, last),
    },
  };
};
