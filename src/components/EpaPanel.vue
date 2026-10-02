<script setup>
// EPA EnviroAtlas: the site's tracts and watershed compared with the rest of the US.
import { num } from '../format.js'
import { rankText } from '../calc/ranking.js'
const props = defineProps({ epa: Object, selected: String, regionMi: Number })
const emit = defineEmits(['select'])
const fmt = (r) => (r.value == null ? 'no data' : num(r.value, r.digits))
</script>

<template>
  <section>
    <h2>Pollution the area already carries <small>(US EPA EnviroAtlas)</small></h2>
    <table>
      <thead><tr><th>Measure</th><th>Site</th><th>Compared with the US</th><th>Within {{ regionMi }} mi</th><th></th></tr></thead>
      <tbody>
        <tr v-for="r in epa.results" :key="r.key" :class="{ on: selected === r.key }">
          <td>{{ r.label }}<br><small>{{ r.vintage }}</small></td>
          <td><b>{{ fmt(r) }}</b><span v-if="r.threshold && r.value >= r.threshold.value" class="flag" :title="r.threshold.note"> above EPA's level of concern</span></td>
          <td>{{ r.nationalPercentile == null ? '–' : rankText(r.nationalPercentile).replace(/^./, (c) => c.toUpperCase()) }} US {{ r.unit === 'tract' ? 'tracts' : 'watersheds' }}</td>
          <td>{{ r.regionRank ? `#${r.regionRank} of ${r.regionN}` : '–' }}</td>
          <td><button type="button" @click="emit('select', selected === r.key ? null : r.key)">{{ selected === r.key ? 'Hide map' : 'Map' }}</button></td>
        </tr>
      </tbody>
    </table>
    <p class="note">The site's value is its highest-ranked census tract within 2 miles, or the watershed it sits in. National comparisons are calculated from EPA's values for every tract or watershed in the country; they are not an EPA rating.</p>
  </section>
</template>

<style scoped>
h2 { font-size: 1rem; color: #2e3a8f; margin: 1.4rem 0 0.6rem; }
h2 small { font-weight: 400; color: #7a7974; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
th, td { padding: 6px 8px; border-bottom: 1px solid #e6e5e1; text-align: left; vertical-align: top; }
th { color: #52514e; font-weight: 600; }
tr.on td { background: #eef0f8; }
small { color: #7a7974; }
.flag { color: #9e1f1a; font-weight: 600; font-size: 0.78rem; }
button { font: inherit; font-size: 0.8rem; padding: 2px 8px; border: 1px solid #2e3a8f; background: #fff; color: #2e3a8f; border-radius: 4px; cursor: pointer; }
.note { color: #7a7974; font-size: 0.78rem; }
</style>
