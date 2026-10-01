# adtech-kit

![CI](https://github.com/pansensoyi/adtech-kit/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

Dependency-free TypeScript utilities for publisher ad ops and programmatic engineering:

| Module | What it does |
|---|---|
| **Targeting** | Sanitise key-values for Google Ad Manager (length limits, special characters, casing), de-duplicate, apply to GPT slots. |
| **Sizes** | Responsive size mappings: resolve sizes per viewport, build `googletag.sizeMapping()` in the right order, parse `"300x250,fluid"`. |
| **Price buckets** | Prebid-compatible granularities (`low`, `medium`, `high`, `auto`, `dense`, or custom), computed in integer cents — plus the full list of price points for GAM line item setup. |
| **OpenRTB 2.6** | Types and a bid response validator (id/currency match, impid, floor, size, adm/nurl, adomain/crid warnings) and winning-bid selection. |

## Install

```bash
npm install github:pansensoyi/adtech-kit
```

## Examples

### GAM key-values

```ts
import { buildTargeting, applyTargeting } from '@pansensoyi/adtech-kit';

const targeting = buildTargeting({
  'Page Category': ['News', 'news', 'Sport'],
  logged_in: true,
  article_id: 12345,
  empty: '',
});
// { page_category: ['news','sport'], logged_in: ['true'], article_id: ['12345'] }

googletag.cmd.push(() => applyTargeting(googletag.pubads(), targeting));
```

### Responsive size mapping

```ts
import { toGptSizeMapping, allSizes, type SizeRule } from '@pansensoyi/adtech-kit';

const rules: SizeRule[] = [
  { viewport: [1024, 0], sizes: [[970, 250], [728, 90]] },
  { viewport: [768, 0], sizes: [[728, 90]] },
  { viewport: [0, 0], sizes: [[320, 50]] },
];

googletag.cmd.push(() => {
  googletag
    .defineSlot('/1234/home/leaderboard', allSizes(rules), 'div-lb')!
    .defineSizeMapping(toGptSizeMapping(googletag.sizeMapping(), rules) as googletag.SizeMappingArray)
    .addService(googletag.pubads());
});
```

### Price buckets

```ts
import { priceBucket, pricePoints } from '@pansensoyi/adtech-kit';

priceBucket(3.87, 'auto');   // "3.85"
priceBucket(42, 'medium');   // "20.00" (capped)
pricePoints('low');          // ["0.50", "1.00", ... "5.00"] -> one GAM line item each
```

### OpenRTB validation

```ts
import { validateBidResponse, winningBids } from '@pansensoyi/adtech-kit';

const { valid, issues, validBids } = validateBidResponse(bidResponse, bidRequest);
const winners = winningBids(validBids); // Map<impid, Bid>
```

## Development

```bash
npm install
npm test
npm run build
```

> GAM limits are defaults based on Google's key-value guidance and are configurable via `SanitizeOptions`. Not affiliated with Google or Prebid.org.

## License

MIT
