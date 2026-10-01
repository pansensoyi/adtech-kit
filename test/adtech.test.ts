import { describe, expect, it, vi } from 'vitest';
import {
  allSizes,
  applyTargeting,
  buildTargeting,
  parseSizes,
  priceBucket,
  pricePoints,
  resolveSizes,
  sanitizeKey,
  sanitizeValue,
  toGptSizeMapping,
  validateBidResponse,
  winningBids,
  type BidRequest,
  type SizeRule,
} from '../src/index';

describe('targeting', () => {
  it('sanitises keys and values to GAM rules', () => {
    expect(sanitizeKey('Page Category!')).toBe('page_category_');
    expect(sanitizeKey('a'.repeat(30))).toHaveLength(20);
    expect(sanitizeValue('Shoes & Bags (Sale)')).toBe('shoes _ bags _sale_');
    expect(sanitizeValue('x'.repeat(50))).toHaveLength(40);
    expect(sanitizeValue('MiXeD', { lowercase: false })).toBe('MiXeD');
  });

  it('builds de-duplicated targeting and drops empties', () => {
    expect(buildTargeting({ Section: ['News', 'news', 'Sport'], logged_in: true, empty: '', nothing: null, n: 3 })).toEqual({
      section: ['news', 'sport'],
      logged_in: ['true'],
      n: ['3'],
    });
  });

  it('applies targeting to a slot', () => {
    const slot = { setTargeting: vi.fn() };
    applyTargeting(slot, { a: ['1'] });
    expect(slot.setTargeting).toHaveBeenCalledWith('a', ['1']);
  });
});

describe('sizes', () => {
  const rules: SizeRule[] = [
    { viewport: [0, 0], sizes: [[320, 50]] },
    { viewport: [1024, 0], sizes: [[970, 250], [728, 90]] },
    { viewport: [768, 0], sizes: [[728, 90], 'fluid'] },
  ];

  it('resolves sizes by viewport', () => {
    expect(resolveSizes(rules, [1280, 800])).toEqual([[970, 250], [728, 90]]);
    expect(resolveSizes(rules, [800, 600])).toEqual([[728, 90], 'fluid']);
    expect(resolveSizes(rules, [375, 667])).toEqual([[320, 50]]);
  });

  it('collects unique sizes and parses strings', () => {
    expect(allSizes(rules)).toHaveLength(4);
    expect(parseSizes('300x250, 728x90 fluid')).toEqual([[300, 250], [728, 90], 'fluid']);
    expect(() => parseSizes('300by250')).toThrow();
  });

  it('builds a GPT size mapping largest-first', () => {
    const calls: number[] = [];
    const builder = { addSize: (vp: [number, number]) => calls.push(vp[0]), build: () => 'built' };
    expect(toGptSizeMapping(builder, rules)).toBe('built');
    expect(calls).toEqual([1024, 768, 0]);
  });
});

describe('price buckets', () => {
  it('matches Prebid granularities', () => {
    expect(priceBucket(1.87, 'low')).toBe('1.50');
    expect(priceBucket(1.87, 'medium')).toBe('1.80');
    expect(priceBucket(1.876, 'high')).toBe('1.87');
    expect(priceBucket(3.87, 'auto')).toBe('3.85');
    expect(priceBucket(7.87, 'auto')).toBe('7.80');
    expect(priceBucket(14.87, 'dense')).toBe('14.50');
    expect(priceBucket(2.99, 'dense')).toBe('2.99');
  });

  it('caps, floors and handles bad input', () => {
    expect(priceBucket(99, 'medium')).toBe('20.00');
    expect(priceBucket(0.29, 'medium')).toBe('0.20');
    expect(priceBucket(0.3, 'medium')).toBe('0.30'); // no float drift
    expect(priceBucket(-1)).toBe('0.00');
    expect(priceBucket(NaN)).toBe('0.00');
  });

  it('lists every price point for line item setup', () => {
    const low = pricePoints('low');
    expect(low[0]).toBe('0.50');
    expect(low[low.length - 1]).toBe('5.00');
    expect(low).toHaveLength(10);
    expect(pricePoints('medium')).toHaveLength(200);
  });
});

describe('openrtb', () => {
  const req: BidRequest = {
    id: 'req1',
    cur: ['USD'],
    imp: [
      { id: '1', bidfloor: 0.5, banner: { format: [{ w: 300, h: 250 }] } },
      { id: '2', banner: { w: 728, h: 90 } },
    ],
  };

  it('accepts a valid response', () => {
    const r = validateBidResponse(
      { id: 'req1', cur: 'USD', seatbid: [{ bid: [{ id: 'b1', impid: '1', price: 1.2, adm: '<div/>', adomain: ['x.com'], crid: 'c', w: 300, h: 250 }] }] },
      req,
    );
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
    expect(r.validBids).toHaveLength(1);
  });

  it('flags errors per bid and keeps the good ones', () => {
    const r = validateBidResponse(
      {
        id: 'req1',
        seatbid: [
          {
            bid: [
              { id: 'ok', impid: '2', price: 2, nurl: 'https://win', w: 728, h: 90 },
              { id: 'low', impid: '1', price: 0.1, adm: 'x' },
              { id: 'bad', impid: '9', price: 1 },
              { id: 'size', impid: '1', price: 1, adm: 'x', w: 320, h: 50 },
            ],
          },
        ],
      },
      req,
    );
    expect(r.valid).toBe(false);
    expect(r.validBids.map((b) => b.id)).toEqual(['ok']);
    const msgs = r.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('|');
    expect(msgs).toMatch(/below bidfloor/);
    expect(msgs).toMatch(/not found/);
    expect(msgs).toMatch(/adm or nurl/);
    expect(msgs).toMatch(/320x50 not allowed/);
  });

  it('rejects mismatched id and currency', () => {
    const r = validateBidResponse({ id: 'other', cur: 'EUR' }, req);
    expect(r.issues.map((i) => i.path)).toEqual(['id', 'cur']);
  });

  it('picks winning bids per imp', () => {
    const w = winningBids([
      { id: 'a', impid: '1', price: 1 },
      { id: 'b', impid: '1', price: 3 },
      { id: 'c', impid: '2', price: 2 },
    ]);
    expect(w.get('1')!.id).toBe('b');
    expect(w.get('2')!.id).toBe('c');
  });
});
