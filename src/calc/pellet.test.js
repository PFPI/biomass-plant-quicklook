// Pellet mill math, checked as a mass balance (there's no published-numbers test like
// Project River's for biomass.test.js, since this is a general tool, not one site's figures).
// Reads the shared assumptions file directly from the R package, like biomass.test.js.
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadParams, stackCo2 } from './wood.js'
import { pelletFuelDemand, impliedRatio } from './pellet.js'

const json = JSON.parse(readFileSync(new URL('../../../r/inst/params/pellet.json', import.meta.url)))
const p = loadParams(json)

describe('pellet mill', () => {
  test('wood intake scales with the ratio and production', () => {
    const d = pelletFuelDemand(500000, p)
    expect(d.greenTons).toBeCloseTo(500000 * p.green_to_pellet_ratio, 6)
    expect(d.dryTons).toBeCloseTo(d.greenTons * (1 - p.moisture), 6)
  })

  test('only the processed share shows up as stack CO2', () => {
    const d = pelletFuelDemand(500000, p)
    expect(d.co2Tons).toBeCloseTo(stackCo2(d.dryTons * p.process_energy_share, p), 6)
    expect(d.co2Tons).toBeLessThan(stackCo2(d.dryTons, p))
  })

  test('impliedRatio inverts pelletFuelDemand\'s greenTons', () => {
    const d = pelletFuelDemand(500000, p)
    expect(impliedRatio(d.greenTons, 500000)).toBeCloseTo(p.green_to_pellet_ratio, 9)
  })

  test('every adjustable value has a default inside its typical range', () => {
    for (const [k, v] of Object.entries(json.params)) {
      if (v.low == null) continue
      expect(v.value, k).toBeGreaterThanOrEqual(v.low)
      expect(v.value, k).toBeLessThanOrEqual(v.high)
    }
  })
})
