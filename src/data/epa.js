// Live EPA EnviroAtlas data around a site. EPA's service accepts browser requests,
// so shapes and values are fetched on demand; national rankings come from the
// refinery's ranking files. Layer definitions: public/data/params/enviroatlas.json.
import { percentile } from '../calc/ranking.js'

async function query(root, service, params) {
  const features = []
  for (let offset = 0; ; offset += 2000) {
    const url = new URL(`${root}/${encodeURIComponent(service)}/FeatureServer/0/query`)
    const p = { where: '1=1', outSR: 4326, resultOffset: offset, resultRecordCount: 2000, ...params }
    for (const [k, v] of Object.entries(p)) url.searchParams.set(k, v)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`EPA EnviroAtlas request failed (${res.status})`)
    const page = await res.json()
    if (page.error) throw new Error(`EPA EnviroAtlas: ${page.error.message}`)
    features.push(...(page.features ?? []))
    if (!page.exceededTransferLimit && !page.properties?.exceededTransferLimit) break
  }
  return features
}

const near = (lon, lat, miles) => ({
  geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: 4326,
  distance: miles, units: 'esriSRUnit_StatuteMile', spatialRel: 'esriSpatialRelIntersects',
})

// Tracts and watersheds within regionMi of the site, with each measure's value and
// national percentile; plus which units count as "the site's" (tracts within nearMi,
// the watershed containing the site).
export async function fetchEpaArea(def, rankings, lon, lat, { regionMi = 50, nearMi = 2 } = {}) {
  const root = def.service_root
  const fields = (unit) => def.measures.filter((m) => m.unit === unit).map((m) => m.field)
  const shapes = { maxAllowableOffset: 0.0005, geometryPrecision: 5, f: 'geojson' }

  const [tracts, hucs, mercury, siteTracts, siteHuc] = await Promise.all([
    query(root, def.units.tract.service, { ...near(lon, lat, regionMi), ...shapes,
      outFields: ['GEOID10', 'County', 'State', 'Population', ...fields('tract')].join(',') }),
    query(root, def.units.huc12.service, { ...near(lon, lat, regionMi), ...shapes,
      outFields: ['HUC_12', 'DMR_Metals_TWPE_lb_eq_yr'].join(',') }),
    // mercury lives in a different service: values only, joined by HUC_12
    query(root, def.measures.find((m) => m.key === 'mercury').service, { ...near(lon, lat, regionMi),
      outFields: 'HUC_12,MercuryImpLen,TotalLength', returnGeometry: false, f: 'json' }),
    query(root, def.units.tract.service, { ...near(lon, lat, nearMi), outFields: 'GEOID10', returnGeometry: false, f: 'json' }),
    query(root, def.units.huc12.service, { ...near(lon, lat, 0), outFields: 'HUC_12', returnGeometry: false, f: 'json' }),
  ])

  const merc = new Map(mercury.map((f) => [f.attributes.HUC_12, f.attributes]))
  for (const f of hucs) Object.assign(f.properties, merc.get(f.properties.HUC_12) ?? {})
  const clean = (v) => (v == null || v < 0 ? null : v)        // EPA uses negative numbers for no data

  const siteIds = {
    tract: new Set(siteTracts.map((f) => f.attributes.GEOID10)),
    huc12: new Set(siteHuc.map((f) => f.attributes.HUC_12)),
  }
  const units = { tract: tracts, huc12: hucs }

  // per measure: every unit's value and national percentile, and the site's highest-ranked unit
  const results = def.measures.map((m) => {
    const feats = units[m.unit]
    const idField = def.units[m.unit].id_field
    for (const f of feats) {
      const v = clean(f.properties[m.field])
      f.properties[m.field] = v
      f.properties[`${m.key}_pctl`] = percentile(v, rankings[m.key])
    }
    const values = feats.map((f) => f.properties[m.field]).filter((v) => v != null)
    const site = feats.filter((f) => siteIds[m.unit].has(f.properties[idField]))
      .sort((a, b) => (b.properties[m.field] ?? -1) - (a.properties[m.field] ?? -1))[0]
    const value = site?.properties[m.field] ?? null
    return {
      ...m, idField, siteId: site?.properties[idField] ?? null, value,
      nationalPercentile: percentile(value, rankings[m.key]), nationalN: rankings[m.key].n,
      regionRank: value == null ? null : values.filter((v) => v > value).length + 1, regionN: values.length,
    }
  })
  return { units, siteIds, results }
}
