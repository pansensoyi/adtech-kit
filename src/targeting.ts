/**
 * Google Ad Manager key-value helpers.
 * Defaults follow GAM's key-value guidance (keys ≤ 20 chars, values ≤ 40 chars,
 * no special characters); all limits are configurable.
 */

export const GAM_SPECIAL_CHARS = /["'=!+#*~;^()<>[\],&]/g;

export interface SanitizeOptions {
  maxKeyLength?: number;
  maxValueLength?: number;
  lowercase?: boolean;
  /** Replacement for disallowed characters and whitespace in keys. */
  replacement?: string;
}

const DEFAULTS: Required<SanitizeOptions> = { maxKeyLength: 20, maxValueLength: 40, lowercase: true, replacement: '_' };

export function sanitizeKey(key: string, opts: SanitizeOptions = {}): string {
  const o = { ...DEFAULTS, ...opts };
  let k = key.trim().replace(GAM_SPECIAL_CHARS, o.replacement).replace(/\s+/g, o.replacement);
  if (o.lowercase) k = k.toLowerCase();
  return k.slice(0, o.maxKeyLength);
}

export function sanitizeValue(value: string | number | boolean, opts: SanitizeOptions = {}): string {
  const o = { ...DEFAULTS, ...opts };
  let v = String(value).trim().replace(GAM_SPECIAL_CHARS, o.replacement).replace(/\s+/g, ' ');
  if (o.lowercase) v = v.toLowerCase();
  return v.slice(0, o.maxValueLength);
}

export type TargetingInput = Record<string, string | number | boolean | null | undefined | Array<string | number | boolean>>;
export type Targeting = Record<string, string[]>;

/**
 * Normalise an arbitrary object into GAM-safe targeting: sanitised keys,
 * de-duplicated string arrays, empty values dropped.
 * Pass the result to `slot.setTargeting(k, v)` or `googletag.pubads().setTargeting(k, v)`.
 */
export function buildTargeting(input: TargetingInput, opts: SanitizeOptions = {}): Targeting {
  const out: Targeting = {};
  for (const [rawKey, rawVal] of Object.entries(input)) {
    if (rawVal == null) continue;
    const key = sanitizeKey(rawKey, opts);
    if (!key) continue;
    const values = (Array.isArray(rawVal) ? rawVal : [rawVal]).map((v) => sanitizeValue(v, opts)).filter(Boolean);
    if (!values.length) continue;
    out[key] = Array.from(new Set([...(out[key] ?? []), ...values]));
  }
  return out;
}

/** Apply targeting to a GPT slot (or pubads service) — anything with setTargeting. */
export function applyTargeting(target: { setTargeting(key: string, value: string | string[]): unknown }, targeting: Targeting): void {
  for (const [k, v] of Object.entries(targeting)) target.setTargeting(k, v);
}
