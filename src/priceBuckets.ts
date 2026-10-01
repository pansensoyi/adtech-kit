/**
 * Header-bidding price buckets (Prebid.js-compatible granularities).
 * All math is done in integer cents to avoid floating-point drift.
 */

export interface BucketRange {
  min: number;
  max: number;
  increment: number;
}

export type Granularity = 'low' | 'medium' | 'high' | 'auto' | 'dense';

export const GRANULARITIES: Record<Granularity, BucketRange[]> = {
  low: [{ min: 0, max: 5, increment: 0.5 }],
  medium: [{ min: 0, max: 20, increment: 0.1 }],
  high: [{ min: 0, max: 20, increment: 0.01 }],
  auto: [
    { min: 0, max: 5, increment: 0.05 },
    { min: 5, max: 10, increment: 0.1 },
    { min: 10, max: 20, increment: 0.5 },
  ],
  dense: [
    { min: 0, max: 3, increment: 0.01 },
    { min: 3, max: 8, increment: 0.05 },
    { min: 8, max: 20, increment: 0.5 },
  ],
};

const cents = (n: number) => Math.round(n * 100);

function resolve(g: Granularity | BucketRange[]): BucketRange[] {
  const ranges = typeof g === 'string' ? GRANULARITIES[g] : g;
  if (!ranges?.length) throw new Error('unknown or empty granularity');
  return [...ranges].sort((a, b) => a.min - b.min);
}

/**
 * Round a CPM DOWN to its bucket, capped at the top bucket's max. Returns a 2-decimal string ("1.35").
 * Prices ≤ 0 or NaN return "0.00".
 */
export function priceBucket(cpm: number, granularity: Granularity | BucketRange[] = 'medium'): string {
  const ranges = resolve(granularity);
  if (!Number.isFinite(cpm) || cpm <= 0) return '0.00';
  const c = Math.floor(cpm * 100 + 1e-6);
  const top = ranges[ranges.length - 1];
  if (c >= cents(top.max)) return (cents(top.max) / 100).toFixed(2);
  const r = ranges.find((x) => c >= cents(x.min) && c < cents(x.max)) ?? ranges[0];
  const inc = cents(r.increment);
  const bucket = cents(r.min) + Math.floor((c - cents(r.min)) / inc) * inc;
  return (bucket / 100).toFixed(2);
}

/**
 * Every price point for a granularity — the list of line items / `hb_pb` values
 * you need to create in Google Ad Manager.
 */
export function pricePoints(granularity: Granularity | BucketRange[] = 'medium'): string[] {
  const ranges = resolve(granularity);
  const out: string[] = [];
  for (const r of ranges) {
    const inc = cents(r.increment);
    for (let c = cents(r.min); c < cents(r.max); c += inc) out.push((c / 100).toFixed(2));
  }
  out.push((cents(ranges[ranges.length - 1].max) / 100).toFixed(2));
  return Array.from(new Set(out)).filter((p) => p !== '0.00');
}
