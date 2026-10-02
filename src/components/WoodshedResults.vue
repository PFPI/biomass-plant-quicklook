<script setup>
// Headline numbers and the forest supply by distance for a biomass facility
// (a combustion plant or a pellet mill -- see r.facilityType).
import { num, millions, thousands, times } from '../format.js'
const props = defineProps({ r: Object })   // results computed in App.vue
const facility = () => (props.r.facilityType === 'pellet' ? 'mill' : 'plant')
</script>

<template>
  <section>
    <h2>Headline numbers</h2>
    <p v-if="r.changed.length" class="changed"><b>Changed from defaults:</b> {{ r.changed.join('; ') }}</p>
    <div class="tiles">
      <div class="tile"><div class="num">{{ millions(r.demand.greenTons) }}</div>green tons of wood a year{{ r.entered ? ' (entered)' : '' }}</div>
      <div class="tile"><div class="num">{{ thousands(r.acres.low) }}–{{ thousands(r.acres.high) }}</div>acres {{ r.thinningShare > 0 ? 'cut' : 'clearcut' }} a year</div>
      <div class="tile"><div class="num">{{ times(r.multiple.x) }}</div>today's {{ r.speciesLabel }} harvest within {{ r.multiple.mi }} miles</div>
      <div class="tile"><div class="num">{{ num(r.trucks.loadsDay) }}</div>loaded trucks each weekday ({{ num(r.trucks.lineMiles, 1) }}-mile line)</div>
      <div class="tile"><div class="num">${{ num(r.haul.fuelCostYr / 1e6, 1) }}M</div>diesel a year (${{ num(r.haul.fuelCostPerTon, 2) }}/ton), {{ num(r.haul.roadMi) }} road miles each way</div>
      <div class="tile"><div class="num">{{ millions(r.demand.co2Tons) }}</div>{{ r.facilityType === 'pellet' ? "tons of CO₂ a year from the mill's dryer (the pellets' own carbon isn't counted here)" : 'tons of stack CO₂ a year' }}, plus {{ thousands(r.haul.dieselCo2Tons) }} from trucks</div>
      <div v-if="r.entered && r.facilityType === 'pellet'" class="tile"><div class="num">{{ num(r.impliedVal, 2) }}</div>green tons of wood per ton of pellets this amount would imply</div>
      <div v-if="r.entered && r.facilityType !== 'pellet'" class="tile"><div class="num">{{ num(r.impliedVal * 100) }}%</div>efficiency this much wood would need to produce {{ num(r.params.capacity_factor * 100) }}% of the year at full output</div>
    </div>

    <h2>{{ r.speciesLabel[0].toUpperCase() + r.speciesLabel.slice(1) }} harvest today and with the {{ facility() }}, by distance</h2>
    <table>
      <thead>
        <tr><th>Within</th><th>{{ r.speciesLabel[0].toUpperCase() + r.speciesLabel.slice(1) }} cut today<br><small>green tons/yr</small></th><th>With the {{ facility() }}</th><th>Increase</th>
          <th v-if="r.species !== 'all'">All species<br><small>increase</small></th><th>Pine share of<br>timberland</th></tr>
      </thead>
      <tbody>
        <tr v-for="s in r.supply" :key="s.radius_mi">
          <td>{{ s.radius_mi }} mi</td>
          <td>{{ thousands(s[`${r.species}_harvest`] * r.gk) }}</td>
          <td>{{ times(1 + r.demand.dryTons / s[`${r.species}_harvest`]) }}</td>
          <td>+{{ num(100 * r.demand.dryTons / s[`${r.species}_harvest`]) }}%</td>
          <td v-if="r.species !== 'all'">+{{ num(100 * r.demand.dryTons / s.all_harvest) }}%</td>
          <td>{{ num(100 * s.pine_type_ac / s.timberland_ac) }}%</td>
        </tr>
      </tbody>
    </table>

    <details class="more">
      <summary>Background information</summary>
      <ul>
        <li><b>Forest data:</b> USDA Forest Service FIA, average annual harvest removals on timberland, from each state's latest survey ({{ r.surveys }}). Counties are weighted by the share of their area inside each circle.</li>
        <li><b>Acres:</b> {{ num(100 * (1 - r.thinningShare)) }}% of the wood from clearcuts and {{ num(100 * r.thinningShare) }}% from thinnings. The low end divides the clearcut wood by all the tree biomass on an acre of 21–40-year-old {{ r.perAcre.forestTypeGroup.replace(' group', '').toLowerCase() }} in {{ r.perAcre.states }} ({{ num(r.perAcre.greenTonsPerAcre) }} green tons per acre); the high end uses {{ r.params.clearcut_green_tons_per_acre }} green tons of logs per acre (Forest2Market/ResourceWise). Thinned wood is divided by {{ r.params.thinning_green_tons_per_acre }} green tons per acre.</li>
        <li><b>Hauling:</b> {{ num(r.haul.straightMi) }} straight-line miles on average, weighted by where {{ r.species === 'all' ? 'wood' : r.speciesLabel }} is available within {{ r.maxR }} miles, × {{ r.params.circuity }} for roads. {{ num(r.params.share_by_truck * 100) }}% of the wood by truck, {{ r.params.haul_days_yr }} delivery days a year. Diesel ${{ num(r.diesel.price, 2) }}/gal ({{ r.diesel.region }}, week of {{ r.diesel.week_of }}, U.S. EIA).</li>
        <li><b>Tons:</b> US short tons. Green tons include the wood's water ({{ num(r.params.moisture * 100) }}% moisture).</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
h2 { font-size: 1rem; color: #2e3a8f; margin: 1.4rem 0 0.6rem; }
.changed { background: #fdf3ee; border-left: 3px solid #e8501c; padding: 6px 10px; font-size: 0.82rem; color: #52514e; margin: 0 0 0.8rem; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.tile { background: #f4f3f0; border-radius: 8px; padding: 12px 14px; font-size: 0.86rem; color: #52514e; }
.tile .num { font-size: 1.55rem; font-weight: 650; color: #0b0b0b; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 8px; border-bottom: 1px solid #e6e5e1; text-align: right; }
th:first-child, td:first-child { text-align: left; }
th { color: #52514e; font-weight: 600; vertical-align: bottom; }
small { font-weight: 400; color: #7a7974; }
details.more { margin-top: 1rem; border: 1px solid #e6e5e1; border-radius: 8px; padding: 0 1rem; background: #fff; font-size: 0.86rem; color: #52514e; }
details.more summary { cursor: pointer; padding: 0.6rem 0; font-weight: 600; color: #2e3a8f; }
</style>
