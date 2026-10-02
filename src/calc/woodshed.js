// Forest supply around a site: the same method as the R package (r/R/woodshed.R).
// County FIA estimates are weighted by the share of each county's area inside each
// radius (FIA's own radius filter doesn't work). Tested against the R results.
import { area, bbox, booleanPointInPolygon, circle, featureCollection, intersect, point } from '@turf/turf'
import { ringMeanDistance } from './wood.js'

export const PINE_TYPE_GROUPS = [
  'Loblolly / shortleaf pine group', 'Longleaf / slash pine group', 'White / red / jack pine group',
]
const VARS = ['pine_stock', 'pine_growth', 'pine_harvest', 'all_stock', 'all_growth', 'all_harvest']

const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

// Share of each county inside each radius -> [{ geoid, radius_mi, weight }]
export function countyWeights(lon, lat, radiiMi, counties) {
  const out = []
  const boxes = counties.features.map((f) => bbox(f))
  const areas = new Map()
  for (const r of radiiMi) {
    const c = circle([lon, lat], r, { units: 'miles', steps: 256 })
    const cb = bbox(c)
    counties.features.forEach((f, i) => {
      if (!overlaps(boxes[i], cb)) return
      const inside = intersect(featureCollection([f, c]))
      if (!inside) return
      const id = f.properties.geoid
      if (!areas.has(id)) areas.set(id, area(f))
      out.push({ geoid: id, radius_mi: r, weight: Math.min(1, area(inside) / areas.get(id)) })
    })
  }
  return out
}

// Supply within each radius (dry tons a year), with approximate standard errors
export function woodshedSupply(weights, counties) {
  const props = new Map(counties.features.map((f) => [f.properties.geoid, f.properties]))
  const radii = [...new Set(weights.map((w) => w.radius_mi))].sort((a, b) => a - b)
  return radii.map((r) => {
    const row = { radius_mi: r, timberland_ac: 0, pine_type_ac: 0 }
    const varSum = Object.fromEntries(VARS.map((v) => [v, 0]))
    for (const v of VARS) row[v] = 0
    for (const w of weights.filter((x) => x.radius_mi === r)) {
      const p = props.get(w.geoid)
      if (!p || p.eval_grp == null) continue            // counties without FIA data (e.g. Wyoming)
      for (const v of VARS) { row[v] += p[v] * w.weight; varSum[v] += p[`${v}_var`] * w.weight ** 2 }
      row.timberland_ac += p.timberland_ac * w.weight
      row.pine_type_ac += p.pine_type_ac * w.weight
    }
    for (const v of VARS) row[`${v}_se`] = Math.sqrt(varSum[v])
    // hardwood = everything that isn't pine (no standard error: it isn't independent of the other two)
    for (const m of ['stock', 'growth', 'harvest']) row[`hardwood_${m}`] = row[`all_${m}`] - row[`pine_${m}`]
    return row
  })
}

// Average haul distance, weighted by the growth left over after harvest in each ring
// (species: 'pine', 'hardwood' or 'all')
export function haulDistance(supply, species = 'pine') {
  const s = [...supply].sort((a, b) => a.radius_mi - b.radius_mi)
  let prev = 0, prevR = 0, num = 0, den = 0
  const rings = s.map((row) => {
    const leftover = row[`${species}_growth`] - row[`${species}_harvest`]
    const ring = { r1: prevR, r2: row.radius_mi, mean_mi: ringMeanDistance(prevR, row.radius_mi), leftover: leftover - prev }
    const w = Math.max(ring.leftover, 0)
    num += ring.mean_mi * w; den += w
    prev = leftover; prevR = row.radius_mi
    return ring
  })
  return { straightMi: num / den, rings }
}

// Standing biomass per acre for the site's region (see r/R/woodshed.R):
// states with >= minShare of the timberland within radiusMi, and their most common forest type
// (species: 'pine' = pine types, 'hardwood' = every other type, 'all' = any type)
export function regionBiomassPerAcre(weights, counties, yieldTable, { radiusMi = 100, minShare = 0.05, moisture = 0.5, species = 'pine' } = {}) {
  const wanted = (g) => species === 'all' || (species === 'pine') === PINE_TYPE_GROUPS.includes(g)
  const props = new Map(counties.features.map((f) => [f.properties.geoid, f.properties]))
  const byEval = new Map()
  for (const w of weights.filter((x) => x.radius_mi === radiusMi)) {
    const p = props.get(w.geoid)
    if (!p || p.eval_grp == null) continue
    byEval.set(p.eval_grp, (byEval.get(p.eval_grp) || 0) + p.timberland_ac * w.weight)
  }
  const total = [...byEval.values()].reduce((a, b) => a + b, 0)
  const evalGrps = [...byEval].filter(([, v]) => v / total >= minShare).map(([k]) => k)
  const rows = yieldTable.filter((y) => evalGrps.includes(y.eval_grp) && wanted(y.forest_type_group))
  const areaByGroup = {}
  for (const y of rows) areaByGroup[y.forest_type_group] = (areaByGroup[y.forest_type_group] || 0) + y.area_ac
  const group = Object.entries(areaByGroup).sort((a, b) => b[1] - a[1])[0]?.[0]
  const g = rows.filter((y) => y.forest_type_group === group)
  const dry = g.reduce((a, y) => a + y.stock_dry_tons, 0) / g.reduce((a, y) => a + y.area_ac, 0)
  return { dryTonsPerAcre: dry, greenTonsPerAcre: dry / (1 - moisture), evalGrps, forestTypeGroup: group }
}

// County (and so state) containing a point
export function countyAt(lon, lat, counties) {
  const pt = point([lon, lat])
  return counties.features.find((f) => booleanPointInPolygon(pt, f))?.properties ?? null
}
