// Number formatting and shared colors for the app.

export const num = (x, d = 0) =>
  x == null || Number.isNaN(x) ? '–' : x.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })
export const thousands = (x) => num(Math.round(x / 1000) * 1000)
export const millions = (x, d = 1) => `${num(x / 1e6, d)} million`
export const pct = (x) => (x == null ? '–' : `${Math.round(100 * x)}%`)
export const times = (x) => `${num(x, 1)}×`

// National-percentile colors, as in the published report's EPA maps
export const PCTL_COLORS = [
  ['#e8e6df', 'Below US median'], ['#f6d58b', '50th–75th percentile'], ['#f0a24a', '75th–90th'],
  ['#d9612b', '90th–95th'], ['#9e1f1a', 'Top 5% in the US'],
]
export function pctlColor(p) {
  if (p == null) return 'transparent'
  const i = p < 0.5 ? 0 : p < 0.75 ? 1 : p < 0.9 ? 2 : p < 0.95 ? 3 : 4
  return PCTL_COLORS[i][0]
}

// Coordinates typed or pasted as decimal ("35.3184, -84.8151") or degrees-minutes-seconds
// ("35°19'06.3"N 84°48'54.5"W"). Returns { lat, lon } or null.
export function parseCoords(text) {
  const s = text.trim()
  const dms = [...s.matchAll(/(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)?\s*['′]?\s*(\d+(?:\.\d+)?)?\s*["″]?\s*([NSEW])/gi)]
  if (dms.length === 2) {
    const val = (m) => {
      const v = +m[1] + (+(m[2] || 0)) / 60 + (+(m[3] || 0)) / 3600
      return /[SW]/i.test(m[4]) ? -v : v
    }
    const [a, b] = dms
    const lat = /[NS]/i.test(a[4]) ? val(a) : val(b)
    const lon = /[EW]/i.test(a[4]) ? val(a) : val(b)
    return { lat, lon }
  }
  const n = s.match(/-?\d+(?:\.\d+)?/g)
  if (n?.length === 2) {
    const [lat, lon] = n.map(Number)
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { lat, lon }
  }
  return null
}
