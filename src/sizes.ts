/** Responsive ad size mapping helpers (compatible with GPT's sizeMapping format). */

export type Size = [number, number] | 'fluid';
export type Viewport = [number, number];
export interface SizeRule {
  viewport: Viewport;
  sizes: Size[];
}

/** GPT expects rules ordered from largest viewport to smallest; returns a sorted copy. */
export function normaliseSizeMapping(rules: SizeRule[]): SizeRule[] {
  return [...rules].sort((a, b) => b.viewport[0] - a.viewport[0] || b.viewport[1] - a.viewport[1]);
}

/** Return the sizes GPT would request for a given viewport (first matching rule). */
export function resolveSizes(rules: SizeRule[], viewport: Viewport): Size[] {
  for (const r of normaliseSizeMapping(rules)) {
    if (viewport[0] >= r.viewport[0] && viewport[1] >= r.viewport[1]) return r.sizes;
  }
  return [];
}

/** Every unique size across rules — useful as the slot's declared sizes in defineSlot. */
export function allSizes(rules: SizeRule[]): Size[] {
  const seen = new Set<string>();
  const out: Size[] = [];
  for (const r of rules)
    for (const s of r.sizes) {
      const key = s === 'fluid' ? s : s.join('x');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(s);
      }
    }
  return out;
}

/** Build a GPT size mapping using `googletag.sizeMapping()` at runtime. */
export function toGptSizeMapping(
  builder: { addSize(viewport: Viewport, sizes: Size[] | Size): unknown; build(): unknown },
  rules: SizeRule[],
): unknown {
  for (const r of normaliseSizeMapping(rules)) builder.addSize(r.viewport, r.sizes);
  return builder.build();
}

/** Parse "300x250,728x90,fluid" into sizes. */
export function parseSizes(input: string): Size[] {
  return input
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((s) => {
      if (s.toLowerCase() === 'fluid') return 'fluid' as const;
      const m = /^(\d+)x(\d+)$/i.exec(s);
      if (!m) throw new Error(`invalid size "${s}"`);
      return [Number(m[1]), Number(m[2])] as [number, number];
    });
}
