import type { ReactNode } from 'react'

// Shared by every public spot that shows a programme's price (listing,
// detail page, homepage stack) so the "struck-through original next to
// the real price" treatment stays consistent everywhere instead of
// being re-implemented per page. original_price_inr is purely a
// display value — only shown when it's actually higher than price_inr.
export function priceNode(priceInr: number | null, originalPriceInr?: number | null): ReactNode {
  if (priceInr == null) return 'Revealing Soon'
  const hasDiscount = originalPriceInr != null && originalPriceInr > priceInr
  if (!hasDiscount) return `₹${priceInr.toLocaleString('en-IN')}`
  return (
    <>
      <span style={{ textDecoration: 'line-through', opacity: 0.5, marginRight: '6px', fontWeight: 500 }}>
        ₹{originalPriceInr!.toLocaleString('en-IN')}
      </span>
      ₹{priceInr.toLocaleString('en-IN')}
    </>
  )
}
