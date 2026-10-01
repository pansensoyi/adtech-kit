/** Minimal OpenRTB 2.6 types and a bid response validator. */

export interface Imp {
  id: string;
  bidfloor?: number;
  bidfloorcur?: string;
  banner?: { w?: number; h?: number; format?: Array<{ w: number; h: number }> };
  video?: Record<string, unknown>;
  native?: Record<string, unknown>;
}

export interface BidRequest {
  id: string;
  imp: Imp[];
  cur?: string[];
  tmax?: number;
}

export interface Bid {
  id: string;
  impid: string;
  price: number;
  adm?: string;
  nurl?: string;
  adomain?: string[];
  crid?: string;
  w?: number;
  h?: number;
}

export interface BidResponse {
  id: string;
  seatbid?: Array<{ seat?: string; bid: Bid[] }>;
  cur?: string;
  nbr?: number;
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  /** Bids that passed every error-level check. */
  validBids: Bid[];
}

/** Validate a bid response against the request it answers. */
export function validateBidResponse(res: BidResponse, req: BidRequest): ValidationResult {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) => issues.push({ path, message, severity: 'error' });
  const warn = (path: string, message: string) => issues.push({ path, message, severity: 'warning' });

  if (res.id !== req.id) err('id', `response id "${res.id}" does not match request id "${req.id}"`);

  const allowedCur = req.cur?.length ? req.cur : ['USD'];
  const cur = res.cur ?? 'USD';
  if (!allowedCur.includes(cur)) err('cur', `currency ${cur} not in request cur ${allowedCur.join(',')}`);

  const imps = new Map(req.imp.map((i) => [i.id, i]));
  const validBids: Bid[] = [];
  const seenBidIds = new Set<string>();

  (res.seatbid ?? []).forEach((sb, si) => {
    if (!sb.bid?.length) warn(`seatbid[${si}]`, 'seatbid has no bids');
    (sb.bid ?? []).forEach((b, bi) => {
      const p = `seatbid[${si}].bid[${bi}]`;
      const before = issues.filter((i) => i.severity === 'error').length;
      if (!b.id) err(`${p}.id`, 'bid id is required');
      else if (seenBidIds.has(b.id)) warn(`${p}.id`, `duplicate bid id "${b.id}"`);
      seenBidIds.add(b.id);

      const imp = imps.get(b.impid);
      if (!imp) err(`${p}.impid`, `impid "${b.impid}" not found in request`);
      if (!(typeof b.price === 'number' && b.price > 0)) err(`${p}.price`, 'price must be a positive number');
      if (imp?.bidfloor != null && b.price < imp.bidfloor) err(`${p}.price`, `price ${b.price} below bidfloor ${imp.bidfloor}`);
      if (!b.adm && !b.nurl) err(`${p}`, 'either adm or nurl is required');
      if (!b.adomain?.length) warn(`${p}.adomain`, 'adomain is recommended for brand safety / blocking');
      if (!b.crid) warn(`${p}.crid`, 'crid is recommended for creative review');

      if (imp?.banner && b.w && b.h) {
        const allowed = [...(imp.banner.format ?? []), ...(imp.banner.w && imp.banner.h ? [{ w: imp.banner.w, h: imp.banner.h }] : [])];
        if (allowed.length && !allowed.some((f) => f.w === b.w && f.h === b.h))
          err(`${p}`, `size ${b.w}x${b.h} not allowed for imp "${imp.id}"`);
      }
      if (issues.filter((i) => i.severity === 'error').length === before) validBids.push(b);
    });
  });

  return { valid: !issues.some((i) => i.severity === 'error'), issues, validBids };
}

/** Pick the highest valid bid per impression. */
export function winningBids(bids: Bid[]): Map<string, Bid> {
  const out = new Map<string, Bid>();
  for (const b of bids) if (!out.has(b.impid) || out.get(b.impid)!.price < b.price) out.set(b.impid, b);
  return out;
}
