// Wood logistics shared by every facility type (combustion plants, pellet mills, ...):
// trucking, hauling, acres and water. Mirrors r/R/wood.R; both are tested against
// Project River's published numbers. All tons are US short tons.

// Default assumptions file (r/inst/params/<facility>.json) -> plain values, with overrides
export function loadParams(json, overrides = {}) {
  const values = Object.fromEntries(Object.entries(json.params).map(([k, v]) => [k, v.value]))
  for (const k of Object.keys(overrides)) {
    if (!(k in values)) throw new Error(`Unknown assumption: ${k}`)
  }
  return { ...values, ...overrides }
}

// CO2 from combusting dry wood (carbon fraction x 44/12). Used both for a combustion
// plant's stack and for the share of a pellet mill's intake burned for kiln heat.
export const stackCo2 = (dryTons, p) => dryTons * p.carbon_fraction * 44 / 12

export function truckLoads(greenTons, p) {
  const loadsYr = greenTons * (p.share_by_truck ?? 1) / p.tons_per_load   // only the share delivered by truck
  const loadsDay = loadsYr / p.haul_days_yr
  return { loadsYr, loadsDay, lineMiles: loadsDay * p.truck_length_ft / 5280 }
}

// average straight-line distance within a ring, wood spread evenly across it
export const ringMeanDistance = (r1, r2) => (2 / 3) * (r2 ** 3 - r1 ** 3) / (r2 ** 2 - r1 ** 2)

export function haulImpacts(straightMi, greenTons, dieselPrice, p) {
  const { loadsYr, loadsDay } = truckLoads(greenTons, p)
  const roadMi = straightMi * p.circuity
  const truckMilesYr = loadsYr * 2 * roadMi                    // loaded out, empty back
  const dieselGalYr = truckMilesYr / p.truck_mpg
  const tripsPerTruck = p.duty_hr / (2 * roadMi / p.avg_mph + p.load_unload_hr)
  return {
    roadMi, truckMilesYr, dieselGalYr,
    fuelCostYr: dieselGalYr * dieselPrice,
    fuelCostPerTon: dieselGalYr * dieselPrice / greenTons,
    dieselCo2Tons: dieselGalYr * p.diesel_co2_lb / 2000,
    dieselPmTons: truckMilesYr * p.diesel_pm_g_per_mi / 907184.74,
    tripsPerTruck, trucksOnRoad: loadsDay / tripsPerTruck,
  }
}

export const acresNeeded = (greenTons, greenTonsPerAcre) => greenTons / greenTonsPerAcre
// Acres when part of the wood comes from thinnings (less wood per acre) and the rest from clearcuts
export const acresByMix = (greenTons, thinningShare, clearcutPerAcre, thinningPerAcre) =>
  acresNeeded(greenTons * (1 - thinningShare), clearcutPerAcre) + acresNeeded(greenTons * thinningShare, thinningPerAcre)
export const waterInWood = (greenTons, p) => greenTons * p.moisture * 2000 / 8.34
