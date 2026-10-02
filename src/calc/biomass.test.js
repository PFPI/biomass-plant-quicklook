// Same checks as r/tests/testthat/test-project-river.R, against Project River's
// published numbers. Reads the shared assumptions file directly from the R package.
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  loadParams, biomassFuelDemand, impliedEfficiency, truckLoads, haulImpacts, acresNeeded, acresByMix, waterInWood,
} from './biomass.js'

const json = JSON.parse(readFileSync(new URL('../../../r/inst/params/biomass.json', import.meta.url)))
const p = loadParams(json)
const d = biomassFuelDemand(500, p)
const close = (a, b) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(1e-9)

describe('Project River', () => {
  test('fuel demand', () => {
    expect(d.mwhOut).toBe(4029600)
    close(d.dryTons, 3330667.44186)
    close(d.greenTons, 6661334.88372)
    close(d.co2Tons, 6106223.64341)
  })
  test("developer's claim implies 27% efficiency", () => close(impliedEfficiency(5e6, 0.4, 500, p), 0.266453395349))
  test('trucks', () => {
    const t = truckLoads(d.greenTons, p)
    close(t.loadsYr, 266453.395349)
    close(t.loadsDay, 1024.82075134)
  })
  test('hauling at the weighted average distance', () => {
    const h = haulImpacts(140.731521197, d.greenTons, 6.68, p)
    close(h.roadMi, 182.950977556)
    close(h.fuelCostYr, 91728460.0384)
    close(h.dieselCo2Tons, 154139.515558)
    close(h.trucksOnRoad, 705.014789318)
    expect(Math.round(h.dieselPmTons)).toBe(15)
  })
  test('acres and water', () => {
    close(acresNeeded(d.greenTons, p.clearcut_green_tons_per_acre), 76567.067629)
    close(waterInWood(d.greenTons, p), 798721209.079)
  })
  test('overrides and typos', () => {
    expect(loadParams(json, { efficiency: 0.25 }).efficiency).toBe(0.25)
    expect(() => loadParams(json, { efficency: 0.25 })).toThrow('Unknown assumption')
  })
})

import { parseCoords } from '../format.js'
test('coordinates in degrees-minutes-seconds or decimal', () => {
  const s = parseCoords(`35°19'06.3"N 84°48'54.5"W`)
  expect(s.lat).toBeCloseTo(35.318417, 5)
  expect(s.lon).toBeCloseTo(-84.815139, 5)
  expect(parseCoords('35.3184, -84.8151')).toEqual({ lat: 35.3184, lon: -84.8151 })
  expect(parseCoords('nonsense')).toBeNull()
})

test('share by truck scales trucks and hauling, not the wood', () => {
  const half = loadParams(json, { share_by_truck: 0.5 })
  close(truckLoads(d.greenTons, half).loadsYr, 266453.395349 / 2)
  close(haulImpacts(140.731521197, d.greenTons, 6.68, half).dieselGalYr, 13731805.395 / 2)
})

test('acres by clearcut/thinning mix', () => {
  close(acresByMix(d.greenTons, 0, 87, 32), acresNeeded(d.greenTons, 87))
  close(acresByMix(d.greenTons, 1, 87, 32), acresNeeded(d.greenTons, 32))
  close(acresByMix(d.greenTons, 0.5, 87, 32), acresNeeded(d.greenTons / 2, 87) + acresNeeded(d.greenTons / 2, 32))
})

test('every adjustable value has a default inside its typical range', () => {
  for (const [k, v] of Object.entries(json.params)) {
    if (v.low == null) continue
    expect(v.value, k).toBeGreaterThanOrEqual(v.low)
    expect(v.value, k).toBeLessThanOrEqual(v.high)
  }
})
