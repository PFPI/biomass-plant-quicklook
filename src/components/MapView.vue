<script setup>
// Map: click to place the site; draws the sourcing rings and, optionally, one EPA
// EnviroAtlas layer colored by national percentile.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { rankText } from '../calc/ranking.js'
import { PCTL_COLORS, pctlColor } from '../format.js'

const props = defineProps({
  site: Object,          // { lon, lat } or null
  radii: Array,          // miles
  epaLayer: Object,      // { features, measure, siteIds } or null
})
const emit = defineEmits(['pick'])

const el = ref(null)
let map, siteMarker, ringLayer, epaGroup, legend

onMounted(() => {
  map = L.map(el.value, { zoomSnap: 0.5 }).setView([37.5, -92], 4)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, NOAA, &copy; OpenStreetMap contributors', maxZoom: 18,
  }).addTo(map)
  ringLayer = L.layerGroup().addTo(map)
  epaGroup = L.layerGroup().addTo(map)
  map.on('click', (e) => emit('pick', { lon: +e.latlng.lng.toFixed(6), lat: +e.latlng.lat.toFixed(6) }))
  draw(); drawEpa()
})
onBeforeUnmount(() => map?.remove())

function draw() {
  if (!map) return
  ringLayer.clearLayers()
  if (siteMarker) { siteMarker.remove(); siteMarker = null }
  if (!props.site) return
  const ll = [props.site.lat, props.site.lon]
  for (const r of props.radii) {
    L.circle(ll, { radius: r * 1609.344, color: '#ffee00', weight: 2.5, dashArray: '6 5', fill: false, interactive: false })
      .addTo(ringLayer)
    L.marker([props.site.lat + r / 69.05, props.site.lon], {
      interactive: false,
      icon: L.divIcon({ className: 'ring-label', html: `${r} mi`, iconSize: null }),
    }).addTo(ringLayer)
  }
  siteMarker = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#0b0b0b', fillOpacity: 1 })
    .bindTooltip('Site').addTo(map)
}

function drawEpa() {
  if (!map) return
  epaGroup.clearLayers()
  legend?.remove(); legend = null
  const layer = props.epaLayer
  if (!layer) return
  const { measure: m, features, siteIds } = layer
  const pk = `${m.key}_pctl`
  L.geoJSON({ type: 'FeatureCollection', features }, {
    style: (f) => ({
      fillColor: pctlColor(f.properties[pk]), fillOpacity: 0.55, color: '#ffffff', weight: 0.5,
    }),
    onEachFeature: (f, lyr) => {
      const p = f.properties
      const v = p[m.field]
      lyr.bindTooltip(`<b>${m.label}</b><br>${m.unit === 'tract' ? 'Census tract ' + p.GEOID10 : 'HUC 12 ' + p.HUC_12}<br>` +
        `${m.short}: <b>${v == null ? 'no data' : v.toLocaleString('en-US', { maximumFractionDigits: m.digits })}</b>` +
        (p[pk] == null ? '' : `<br><span style="color:#7a7974">${rankText(p[pk]).replace(/^./, (c) => c.toUpperCase())} US ${m.unit === 'tract' ? 'tracts' : 'watersheds'}</span>`), { sticky: true })
    },
  }).addTo(epaGroup)
  // the site's own tracts or watershed: dark line on a white edge
  const own = features.filter((f) => siteIds.has(f.properties[m.unit === 'tract' ? 'GEOID10' : 'HUC_12']))
  L.geoJSON({ type: 'FeatureCollection', features: own }, { style: { fill: false, color: '#fff', weight: 5 }, interactive: false }).addTo(epaGroup)
  L.geoJSON({ type: 'FeatureCollection', features: own }, { style: { fill: false, color: '#16130f', weight: 2.5 }, interactive: false }).addTo(epaGroup)
  legend = L.control({ position: 'bottomright' })
  legend.onAdd = () => {
    const d = L.DomUtil.create('div', 'legend')
    d.innerHTML = '<b>Compared with the<br>rest of the US</b>' +
      PCTL_COLORS.map(([c, l]) => `<div><i style="background:${c}"></i>${l}</div>`).join('')
    return d
  }
  legend.addTo(map)
}

watch(() => [props.site, props.radii], () => {
  draw()
  if (props.site) map.setView([props.site.lat, props.site.lon], props.epaLayer ? 10 : 6.5)
}, { deep: true })
watch(() => props.epaLayer, (v) => {
  drawEpa()
  if (v && props.site) map.setView([props.site.lat, props.site.lon], 10)
  else if (props.site) map.setView([props.site.lat, props.site.lon], 6.5)
})
</script>

<template>
  <div ref="el" class="map"></div>
</template>

<style scoped>
.map { height: 100%; min-height: 420px; border-radius: 8px; }
:deep(.ring-label) { background: #fff; color: #0b0b0b; font: 700 11px system-ui, sans-serif; padding: 1px 4px; border-radius: 3px; white-space: nowrap; transform: translate(-50%, -50%); }
:deep(.legend) { background: #fff; padding: 8px 10px; border-radius: 6px; font: 12px/1.5 system-ui, sans-serif; color: #52514e; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
:deep(.legend i) { display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px; border-radius: 2px; }
</style>
