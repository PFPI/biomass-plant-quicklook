// National percentile of a value, from the ranking files the refinery writes
// (r/R/enviroatlas.R: ea_ranking / ea_percentile). Share of US tracts or watersheds
// with a strictly lower value; ties count as not lower, so a zero is never "high".

const signif = (x, digits) => (x === 0 ? 0 : Number(x.toPrecision(digits)))

// Prepare a ranking file once: cumulative counts for fast lookups
export function prepareRanking(r) {
  const below = new Array(r.values.length)
  let c = 0
  for (let i = 0; i < r.values.length; i++) { below[i] = c; c += r.counts[i] }
  return { ...r, below }
}

export function percentile(x, r) {
  if (x == null || Number.isNaN(x)) return null
  const v = signif(x, r.digits)
  // first index whose value is >= v; everything before it is strictly lower
  let lo = 0, hi = r.values.length
  while (lo < hi) { const mid = (lo + hi) >> 1; if (r.values[mid] < v) lo = mid + 1; else hi = mid }
  return (lo < r.values.length ? r.below[lo] : r.n) / r.n
}

// "higher than 87% of" / "in the top 0.8% of" (never rounds up to "higher than 100%")
export function rankText(p) {
  if (p == null) return ''
  if (p >= 0.99) return `in the top ${Math.ceil(1000 * (1 - p)) / 10}% of`
  return `higher than ${Math.floor(100 * p)}% of`
}
