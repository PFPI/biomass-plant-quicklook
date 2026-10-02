// Load the prepared data files in public/data/ (written by the R refinery). Each file is
// fetched once and kept for the session.
import { prepareRanking } from '../calc/ranking.js'

const cache = new Map()
const base = `${import.meta.env.BASE_URL}data/`

export function loadJson(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(base + path).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`)
      return r.json()
    }))
  }
  return cache.get(path)
}

export const loadParams = (facility) => loadJson(`params/${facility}.json`)
export const loadCounties = () => loadJson('counties.geojson')
export const loadYield = () => loadJson('fia_yield.json')
export const loadEvaluations = () => loadJson('fia_evaluations.json')
export const loadDiesel = () => loadJson('diesel.json')
export const loadEpaMeasures = () => loadJson('params/enviroatlas.json')
export const loadRanking = (key) => loadJson(`rankings/${key}.json`).then(prepareRanking)
export const loadExamples = () => loadJson('examples/plants.json')
