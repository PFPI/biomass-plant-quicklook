<script setup>
// pfpi-impact: drop a pin, describe the plant, get the woodshed, trucking and the
// pollution the area already carries. Calculations in src/calc/ (tested against R).
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import MapView from './components/MapView.vue'
import WoodshedResults from './components/WoodshedResults.vue'
import EpaPanel from './components/EpaPanel.vue'
import AssumptionsPanel from './components/AssumptionsPanel.vue'
import { loadParams as loadParamsJson, loadCounties, loadYield, loadEvaluations, loadDiesel, loadEpaMeasures, loadRanking, loadExamples } from './data/load.js'
import { loadParams, truckLoads, haulImpacts, acresByMix, stackCo2, biomassFuelDemand, impliedEfficiency } from './calc/biomass.js'
import { pelletFuelDemand, impliedRatio } from './calc/pellet.js'
import { countyWeights, woodshedSupply, haulDistance, regionBiomassPerAcre, countyAt } from './calc/woodshed.js'
import { fetchEpaArea } from './data/epa.js'
import { parseCoords } from './format.js'

const REGION_MI = 50
const DEFAULT_RADII = [50, 75, 100]
const SPECIES_LABEL = { pine: 'pine', hardwood: 'hardwood', all: 'total' }

const coordText = ref('35.3184, -84.8151')
const site = ref(null)
const radii = ref(DEFAULT_RADII)   // distance bands in miles, from the Wood assumptions
const facilityType = ref('combustion')   // 'combustion' or 'pellet' -- which params file and demand formula apply
const capacityKey = computed(() => (facilityType.value === 'pellet' ? 'plant_capacity_tons_yr' : 'plant_mw'))
const demandFn = computed(() => (facilityType.value === 'pellet' ? pelletFuelDemand : biomassFuelDemand))

const examples = shallowRef(null)
loadExamples().then((j) => { examples.value = j })
const exampleGroups = computed(() => {
  if (!examples.value) return []
  const by = (t) => examples.value.examples.filter((e) => e.type === t)
  return [
    { label: 'Combustion plants', items: by('combustion') },
    { label: 'Pellet mills', items: by('pellet') },
  ].filter((g) => g.items.length)
})
const activeExample = ref(null)   // the example currently loaded, if any (cleared on any manual change)
function loadExample(id) {
  const ex = examples.value?.examples.find((e) => e.id === id)
  if (!ex) return
  facilityType.value = ex.type
  site.value = { lat: ex.lat, lon: ex.lon }
  coordText.value = `${ex.lat}, ${ex.lon}`
  activeExample.value = ex
  for (const [k, v] of Object.entries(ex.capacity ?? {})) update(k, v)
  for (const [k, v] of Object.entries(ex.overrides ?? {})) update(k, v)
}

const status = ref('')        // what's loading
const error = ref('')
const geo = shallowRef(null)  // heavy per-site results: weights, supply, region info
const epa = shallowRef(null)
const epaSelected = ref(null)

function setSite(s) {
  site.value = s
  coordText.value = `${s.lat}, ${s.lon}`
  activeExample.value = null
}
function useTyped() {
  const s = parseCoords(coordText.value)
  if (!s) { error.value = 'Couldn\'t read those coordinates. Try "35.3184, -84.8151" or 35°19\'06.3"N 84°48\'54.5"W.'; return }
  error.value = ''
  site.value = { lat: +s.lat.toFixed(6), lon: +s.lon.toFixed(6) }
  activeExample.value = null
}

// "50, 75, 100" -> [50, 75, 100], or null when it isn't a sensible list of distances
function parseBands(text) {
  const parts = String(text ?? '').split(/[\s,;]+/).filter(Boolean).map(Number)
  if (!parts.length || parts.length > 8 || parts.some((n) => !Number.isFinite(n) || n < 1 || n > 300)) return null
  return [...new Set(parts)].sort((a, b) => a - b)
}
const nearest = (arr, target) => arr.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))

// Forest and EPA data for a site: recomputed when the pin or the distance bands move
// (EPA data only when the pin moves)
watch([site, radii], async ([s, rr], old) => {
  if (!s) return
  const moved = s !== old?.[0]
  error.value = ''; geo.value = null
  if (moved) { epa.value = null; epaSelected.value = null }
  const maxR = Math.max(...rr)
  try {
    status.value = `Totaling the forest within ${maxR} miles…`
    const [counties, yieldTable, evals, diesel] = await Promise.all([loadCounties(), loadYield(), loadEvaluations(), loadDiesel()])
    const county = countyAt(s.lon, s.lat, counties)
    if (!county) throw new Error('That point is outside the continental US.')
    await new Promise((r) => setTimeout(r, 30))     // let the status message paint before the heavy step
    const weights = countyWeights(s.lon, s.lat, rr, counties)
    const supply = woodshedSupply(weights, counties)
    const perAcreMi = nearest(rr, 100)
    const perAcre = Object.fromEntries(['pine', 'hardwood', 'all'].map((sp) => [sp, regionBiomassPerAcre(weights, counties, yieldTable, { radiusMi: perAcreMi, species: sp })]))
    const evalName = new Map(evals.map((e) => [e.eval_grp, e]))
    const used = [...new Set(weights.filter((w) => w.radius_mi === maxR).map((w) => counties.features.find((f) => f.properties.geoid === w.geoid)?.properties.eval_grp).filter(Boolean))]
    const byYear = {}
    for (const ev of used) { const e = evalName.get(ev); (byYear[e.year] ||= []).push(e.state) }
    const surveys = Object.keys(byYear).sort().map((y) => `${y}: ${byYear[y].sort().join(', ')}`).join('; ')
    const padd = diesel.states.find((x) => x.state === county.state)?.padd ?? 'US'
    const price = diesel.prices.find((p) => p.region === padd) ?? diesel.prices.find((p) => p.region === 'US')
    geo.value = {
      county, supply, perAcre, surveys, maxR,
      perAcreStates: perAcre.pine.evalGrps.map((e) => evalName.get(e)?.state).join(', '),
      diesel: { ...price, region: padd === 'US' ? 'US average' : padd.replace('PADD', 'PADD ') },
      missingFia: county.eval_grp == null,
    }
    if (!moved && epa.value) { status.value = ''; return }
    status.value = 'Fetching EPA data…'
    const def = await loadEpaMeasures()
    const rankings = Object.fromEntries(await Promise.all(def.measures.map(async (m) => [m.key, await loadRanking(m.key)])))
    epa.value = await fetchEpaArea(def, rankings, s.lon, s.lat, { regionMi: REGION_MI })
    status.value = ''
  } catch (e) {
    error.value = e.message; status.value = ''
  }
})

const paramsJson = shallowRef(null)
watch(facilityType, (ft) => { loadParamsJson(ft === 'pellet' ? 'pellet' : 'biomass').then((j) => { paramsJson.value = j }) }, { immediate: true })

// ---- Assumptions: every value the user can change ----
// All defaults, low/high ranges, sources, groups and display hints live in
// public/data/params/biomass.json (shared with R). Fractions are shown as percentages.
// A value of null means "use the default"; site- and plant-specific defaults (diesel price,
// biomass per acre, wood needed) follow the site and the other assumptions.
const values = reactive({})
const entry = (key) => paramsJson.value?.params[key] ?? paramsJson.value?.app.extra[key]
const ui = (key) => paramsJson.value?.app.ui[key] ?? {}
const toDisplay = (key, v) => (v != null && ui(key).percent ? +(v * 100).toFixed(4) : v)
const staticDefault = (key) => toDisplay(key, entry(key)?.value ?? null)

const siteDefaults = computed(() => {
  const g = geo.value
  if (!g) return {}
  const sp = values.species ?? staticDefault('species')
  let pa = g.perAcre[sp]
  if (!Number.isFinite(pa.greenTonsPerAcre)) pa = g.perAcre.pine      // no stands of that type nearby
  return {
    diesel_price: g.diesel.price,
    biomass_per_acre: Math.round(pa.greenTonsPerAcre),
    _perAcre: pa,
  }
})

// the plant's parameters with the user's changes applied
const plantParams = computed(() => {
  if (!paramsJson.value) return null
  const overrides = {}
  for (const k of Object.keys(paramsJson.value.params)) {
    if (values[k] == null) continue
    overrides[k] = ui(k).percent ? values[k] / 100 : values[k]
  }
  return loadParams(paramsJson.value, overrides)
})
const calculatedGreenTons = computed(() => (plantParams.value
  ? Math.round(demandFn.value(Number(values[capacityKey.value] ?? staticDefault(capacityKey.value)), plantParams.value).greenTons) : null))

const defaultOf = (key) => (key === 'green_tons' ? calculatedGreenTons.value : siteDefaults.value[key] ?? staticDefault(key))
const get = (key) => values[key] ?? defaultOf(key)

const groups = computed(() => {
  if (!paramsJson.value) return []
  return paramsJson.value.app.groups.map((grp) => ({
    title: grp.title, open: grp.open,
    fields: grp.fields.map((key) => {
      const p = entry(key) ?? {}
      const u = ui(key)
      let source = p.source
      if (key === 'diesel_price' && geo.value) source = `U.S. EIA, ${geo.value.diesel.region}, week of ${geo.value.diesel.week_of}`
      if (key === 'biomass_per_acre' && geo.value) {
        const pa = siteDefaults.value._perAcre
        source = `FIA, 21–40-year-old ${pa.forestTypeGroup.replace(' group', '').toLowerCase()}, in ${geo.value.perAcreStates}`
      }
      const type = p.options ? 'select' : key === 'distance_bands' ? 'text' : 'number'
      return {
        key, ...u, type, options: p.options,
        label: key === 'diesel_price' ? 'Diesel price' : key === 'biomass_per_acre' ? 'High estimate biomass per acre' : p.label,
        unit: u.unit ?? (key === 'diesel_price' ? '$ per gallon' : key === 'biomass_per_acre' ? 'green tons per acre' : p.unit),
        note: key === 'biomass_per_acre' ? 'Assumes every green ton on the acre is taken.' : p.note,
        default: defaultOf(key), low: toDisplay(key, p.low), high: toDisplay(key, p.high), rangeSource: p.range_source,
        source, url: p.url,
        error: key === 'distance_bands' && values.distance_bands != null && !parseBands(values.distance_bands)
          ? 'Enter up to 8 distances from 1 to 300 miles, like 50, 100, 200.' : '',
      }
    }),
  }))
})

function update(key, v) {
  values[key] = v === '' ? null : v
  // clearcut and thinning shares always add to 100%
  if (key === 'thinning_share' || key === 'clearcut_share') {
    const other = key === 'thinning_share' ? 'clearcut_share' : 'thinning_share'
    values[other] = typeof v === 'number' ? Math.min(100, Math.max(0, 100 - v)) : null
  }
  if (key === 'distance_bands') {
    const b = parseBands(values.distance_bands ?? staticDefault('distance_bands'))
    if (b && b.join() !== radii.value.join()) radii.value = b
  }
}
const resetField = (key) => update(key, null)
function resetAll() { for (const k of Object.keys(values)) update(k, null) }

// bands start from the file's default once it loads
watch(paramsJson, (j) => { const b = j && parseBands(j.app.extra.distance_bands.value); if (b && b.join() !== radii.value.join()) radii.value = b })

// what differs from the defaults, listed with the results
const changed = computed(() => groups.value.flatMap((g) => g.fields)
  .filter((f) => values[f.key] != null && f.default != null && values[f.key] !== f.default)
  .map((f) => {
    const fmt = (v) => (f.type === 'select' ? f.options.find((o) => o.value === v)?.label : f.type === 'text' ? v : f.percent ? `${v}%` : Number(v).toLocaleString('en-US'))
    return `${f.label}: ${fmt(values[f.key])} (default ${fmt(f.default)})`
  }))

// ---- Plant numbers: recomputed instantly as values change ----
const results = computed(() => {
  const p = plantParams.value
  if (!geo.value || !p || get('diesel_price') == null) return null
  const capacity = Number(get(capacityKey.value))
  const greenTons = Number(get('green_tons'))
  const entered = greenTons > 0 && greenTons !== calculatedGreenTons.value
  const pellet = facilityType.value === 'pellet'
  let demand = demandFn.value(capacity, p)
  let impliedVal = null
  if (entered) {
    const dry = greenTons * (1 - p.moisture)
    const co2 = pellet ? stackCo2(dry * p.process_energy_share, p) : stackCo2(dry, p)
    demand = { ...demand, greenTons, dryTons: dry, co2Tons: co2 }
    impliedVal = pellet ? impliedRatio(greenTons, capacity) : impliedEfficiency(greenTons, p.moisture, capacity, p)
  }
  const g = geo.value
  const species = get('species')
  const hd = haulDistance(g.supply, species)
  const dieselPrice = get('diesel_price')
  const haul = haulImpacts(hd.straightMi, demand.greenTons, dieselPrice, p)
  const thin = get('thinning_share') / 100
  const nearRow = g.supply.find((s) => s.radius_mi === nearest(g.supply.map((x) => x.radius_mi), 100))
  return {
    params: p, demand, supply: g.supply, gk: 1 / (1 - p.moisture), species, speciesLabel: SPECIES_LABEL[species],
    facilityType: facilityType.value, entered, impliedVal,
    trucks: truckLoads(demand.greenTons, p),
    haul: { ...haul, straightMi: hd.straightMi },
    thinningShare: thin,
    acres: {
      low: acresByMix(demand.greenTons, thin, get('biomass_per_acre'), p.thinning_green_tons_per_acre),
      high: acresByMix(demand.greenTons, thin, p.clearcut_green_tons_per_acre, p.thinning_green_tons_per_acre),
    },
    multiple: { mi: nearRow.radius_mi, x: 1 + demand.dryTons / nearRow[`${species}_harvest`] },
    maxR: g.maxR,
    perAcre: { ...siteDefaults.value._perAcre, states: g.perAcreStates, greenTonsPerAcre: get('biomass_per_acre') },
    surveys: g.surveys, diesel: { ...g.diesel, price: dieselPrice }, changed: changed.value,
  }
})

const epaLayer = computed(() => {
  if (!epa.value || !epaSelected.value) return null
  const r = epa.value.results.find((x) => x.key === epaSelected.value)
  return { measure: r, features: epa.value.units[r.unit], siteIds: epa.value.siteIds[r.unit] }
})
</script>

<template>
  <header class="bar"><strong>pfpi-impact</strong><span>Biomass facility quick look</span></header>
  <main>
    <aside>
      <h2>Site</h2>
      <p class="hint">Click the map, paste coordinates, or load an example.</p>
      <select class="examples" aria-label="Facility type" v-model="facilityType" @change="activeExample = null">
        <option value="combustion">Combustion plant</option>
        <option value="pellet">Pellet mill</option>
      </select>
      <form @submit.prevent="useTyped">
        <input v-model="coordText" placeholder="35.3184, -84.8151" aria-label="Coordinates"  />
        <button type="submit">Go</button>
      </form>
      <select class="examples" aria-label="Load an example" :value="activeExample?.id ?? ''" @change="loadExample($event.target.value)">
        <option value="">Custom site</option>
        <optgroup v-for="g in exampleGroups" :key="g.label" :label="g.label">
          <option v-for="ex in g.items" :key="ex.id" :value="ex.id">{{ ex.name }}{{ ex.status === 'proposed' ? ' (proposed)' : '' }}</option>
        </optgroup>
      </select>
      <p v-if="geo" class="where">{{ geo.county.name }} County, {{ geo.county.state }}</p>
      <p v-if="activeExample" class="example-note">{{ activeExample.note }} <a v-if="/^https?:/.test(activeExample.source)" :href="activeExample.source.split(' ')[0]" target="_blank" rel="noopener">Source</a><template v-else> {{ activeExample.source }}</template></p>

      <AssumptionsPanel :groups="groups" :values="values"
        @update="update" @reset="resetField" @reset-all="resetAll" />
    </aside>

    <div class="content">
      <div class="map-wrap">
        <MapView :site="site" :radii="radii" :epa-layer="epaLayer" @pick="setSite" />
      </div>
      <p v-if="status" class="status">{{ status }}</p>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="!site" class="intro">Drop a pin where a plant is proposed to see how much wood it would need, how that compares with the forest and mills nearby, what trucking it would take, and the pollution the area already carries.</p>
      <p v-if="geo?.missingFia" class="error">FIA has no growth or harvest data for this county's state (Wyoming), so forest numbers there are missing.</p>
      <WoodshedResults v-if="results" :r="results" />
      <EpaPanel v-if="epa" :epa="epa" :selected="epaSelected" :region-mi="REGION_MI" @select="(k) => (epaSelected = k)" />
    </div>
  </main>
</template>

<style scoped>
.bar { display: flex; gap: 1rem; align-items: baseline; background: #1d2766; color: #fff; padding: 0.8rem 1.2rem; }
.bar span { opacity: 0.8; font-size: 0.9rem; }
main { display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem; padding: 1.2rem; max-width: 1280px; margin: 0 auto; }
@media (max-width: 860px) { main { grid-template-columns: 1fr; } }
aside h2 { font-size: 0.95rem; color: #2e3a8f; margin: 1rem 0 0.4rem; }
aside h2 small { font-weight: 400; color: #7a7974; }
.hint, .where { font-size: 0.82rem; color: #52514e; margin: 0.2rem 0; }
.where { font-weight: 600; color: #0b0b0b; }
.examples { display: block; width: 100%; margin: 0.5rem 0; padding: 0.35rem 0.5rem; font: inherit; border: 1px solid #c9c7c0; border-radius: 4px; background: #fff; box-sizing: border-box; }
.example-note { font-size: 0.76rem; color: #7a7974; margin: 0.1rem 0 0.4rem; }
form { display: flex; gap: 6px; }
form input { flex: 1; }
input { padding: 0.35rem 0.5rem; font: inherit; border: 1px solid #c9c7c0; border-radius: 4px; box-sizing: border-box; }
label { display: block; font-size: 0.82rem; color: #52514e; margin-bottom: 0.5rem; }
label input { display: block; width: 100%; margin-top: 0.15rem; }
button { font: inherit; padding: 0.35rem 0.8rem; background: #2e3a8f; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
.map-wrap { height: 460px; }
.status { color: #2e3a8f; font-size: 0.9rem; }
.error { color: #9e1f1a; font-size: 0.9rem; }
.intro { color: #52514e; }
</style>
