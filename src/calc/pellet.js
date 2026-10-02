// Wood pellet mill calculations: the same formulas as the R package (r/R/pellet.R).
// Unlike a combustion plant, a pellet mill's demand comes from production capacity
// (pellets out), not megawatts, and most of the carbon leaves as pellets rather than
// stack CO2 -- only the share of intake burned for kiln/dryer heat combusts on site.
// Shared wood logistics (trucking, hauling, acres) live in wood.js.
import { stackCo2 } from './wood.js'

export function pelletFuelDemand(tonsYr, p) {
  const greenTons = tonsYr * p.green_to_pellet_ratio
  const dryTons = greenTons * (1 - p.moisture)
  const processedDryTons = dryTons * p.process_energy_share   // burned for kiln/dryer heat, not pelletized
  return { greenTons, dryTons, co2Tons: stackCo2(processedDryTons, p) }
}

// Green-to-pellet ratio a developer's claimed wood intake and output would imply
export function impliedRatio(greenTons, tonsYr) {
  return greenTons / tonsYr
}
