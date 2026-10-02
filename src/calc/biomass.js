// Combustion biomass power plant calculations: the same formulas as the R package
// (r/R/biomass.R). Both are tested against Project River's published numbers,
// so the app and R can't drift apart. All tons are US short tons. Shared wood
// logistics (trucking, hauling, acres) live in wood.js.
import { stackCo2 } from './wood.js'

export { loadParams, stackCo2, truckLoads, ringMeanDistance, haulImpacts, acresNeeded, acresByMix, waterInWood } from './wood.js'

export function biomassFuelDemand(mw, p) {
  const mwhOut = mw * 8760 * p.capacity_factor
  const fuelMmbtu = mwhOut * 3.412 / p.efficiency
  const dryTons = fuelMmbtu / (2000 * p.btu_per_dry_lb / 1e6)
  return { mwhOut, fuelMmbtu, dryTons, greenTons: dryTons / (1 - p.moisture), co2Tons: stackCo2(dryTons, p) }
}

export function impliedEfficiency(greenTons, moisture, mw, p) {
  const mwhOut = mw * 8760 * p.capacity_factor
  return mwhOut * 3.412 / (greenTons * (1 - moisture) * 2000 * p.btu_per_dry_lb / 1e6)
}
