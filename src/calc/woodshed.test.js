// The app's woodshed must match the R package (same simplified counties, same data):
// targets are r/ results from refinery data at the Project River site.
import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { countyAt, countyWeights, haulDistance, regionBiomassPerAcre, woodshedSupply } from './woodshed.js'

const read = (p) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url)))
const counties = read('counties.geojson')
const yieldTable = read('fia_yield.json')
const site = [-84.815139, 35.318417]
const weights = countyWeights(...site, [50, 75, 100, 150, 200], counties)
const supply = woodshedSupply(weights, counties)
const at = (r) => supply.find((s) => s.radius_mi === r)
const near = (a, b, tol) => expect(Math.abs(a - b) / b).toBeLessThan(tol)

describe('woodshed at the Project River site (vs R, simplified counties)', () => {
  // R and the app compute circle areas slightly differently (projected vs spherical), so allow 0.5%
  test('pine harvest by radius', () => {
    near(at(50).pine_harvest, 488555.0803, 0.005)
    near(at(100).pine_harvest, 1431079.7518, 0.005)
    near(at(200).pine_harvest, 16712910.7761, 0.005)
  })
  test('pine growth and timberland', () => {
    near(at(50).pine_growth, 1401627.993, 0.005)
    near(at(100).timberland_ac, 11209186.799, 0.005)
  })
  test('weighted average haul distance', () => near(haulDistance(supply).straightMi, 140.9513247, 0.005))
  test('biomass per acre picks Project River states and loblolly pine', () => {
    const b = regionBiomassPerAcre(weights, counties, yieldTable)
    expect(new Set(b.evalGrps)).toEqual(new Set(['472024', '132025', '372024', '12025']))
    expect(b.forestTypeGroup).toBe('Loblolly / shortleaf pine group')
    near(b.dryTonsPerAcre, 66.49037, 0.005)
  })
  test('hardwood is everything that is not pine', () => {
    near(at(100).hardwood_harvest, at(100).all_harvest - at(100).pine_harvest, 1e-9)
    const b = regionBiomassPerAcre(weights, counties, yieldTable, { species: 'hardwood' })
    expect(b.forestTypeGroup).toMatch(/Oak|hardwood|Maple/i)
  })
  test('the site is in Bradley County, Tennessee', () => {
    const c = countyAt(...site, counties)
    expect(c.name).toBe('Bradley')
    expect(c.state).toBe('TN')
  })
})
