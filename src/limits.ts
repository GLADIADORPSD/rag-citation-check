import type { CitationCheckInputError, CitationCheckLimits } from './contracts.js';

export const HARD_LIMITS: Readonly<CitationCheckLimits> = Object.freeze({
  answerBytes: 128 * 1024,
  sourceCount: 500,
  sourceContentBytes: 1024 * 1024,
  totalSourceContentBytes: 8 * 1024 * 1024,
  claimCount: 5_000,
  citationsPerClaim: 100,
  findingCount: 10_000,
  sourceIdCharacters: 64,
  quoteBytes: 64 * 1024,
});

export const DEFAULT_LIMITS: Readonly<CitationCheckLimits> = HARD_LIMITS;

const LIMIT_KEYS = Object.freeze(Object.keys(HARD_LIMITS) as (keyof CitationCheckLimits)[]);
const LIMIT_KEY_SET = new Set<string>(LIMIT_KEYS);

export type ResolvedOptionsResult =
  | { readonly kind: 'accepted'; readonly limits: Readonly<CitationCheckLimits> }
  | { readonly kind: 'rejected'; readonly error: CitationCheckInputError };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionError = (message: string, path: string): ResolvedOptionsResult => ({
  kind: 'rejected',
  error: { code: 'OPTION_INVALID', message, path },
});

export const resolveOptions = (options: unknown): ResolvedOptionsResult => {
  if (options === undefined) {
    return { kind: 'accepted', limits: DEFAULT_LIMITS };
  }

  if (!isRecord(options)) {
    return optionError('Options must be an object.', '$options');
  }

  for (const key of Object.keys(options)) {
    if (key !== 'limits') {
      return optionError('Options contain an unknown property.', `$options.${key}`);
    }
  }

  const configuredLimits = options['limits'];
  if (configuredLimits === undefined) {
    return { kind: 'accepted', limits: DEFAULT_LIMITS };
  }

  if (!isRecord(configuredLimits)) {
    return optionError('Limits must be an object.', '$options.limits');
  }

  for (const key of Object.keys(configuredLimits)) {
    if (!LIMIT_KEY_SET.has(key)) {
      return optionError('Limits contain an unknown property.', `$options.limits.${key}`);
    }
  }

  const limits: { -readonly [Key in keyof CitationCheckLimits]: CitationCheckLimits[Key] } = {
    ...HARD_LIMITS,
  };
  for (const key of LIMIT_KEYS) {
    const value = configuredLimits[key];
    if (value === undefined) {
      continue;
    }

    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > HARD_LIMITS[key]
    ) {
      return optionError(
        'A limit must be a non-negative safe integer no greater than its hard limit.',
        `$options.limits.${key}`,
      );
    }

    limits[key] = value;
  }

  return { kind: 'accepted', limits: Object.freeze(limits) };
};

export const utf8ByteLength = (value: string): number => Buffer.byteLength(value, 'utf8');

export type LimitErrorArguments = {
  readonly code: CitationCheckInputError['code'];
  readonly path: string;
  readonly limit: number;
  readonly actual: number;
};

export const limitError = ({
  code,
  path,
  limit,
  actual,
}: LimitErrorArguments): CitationCheckInputError => ({
  code,
  message: 'Input exceeds a configured safety limit.',
  path,
  limit,
  actual,
});
