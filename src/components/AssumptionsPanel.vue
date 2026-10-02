<script setup>
// Every adjustable assumption, in collapsible groups, with its default, typical low/high
// range and source. Values the user changes are highlighted and can be reset one at a time
// or all at once. A null value means "use the default".
import { num } from '../format.js'
const props = defineProps({
  groups: Array,      // [{ title, open, fields: [{ key, label, unit, step, min, max, percent, default, low, high, rangeSource, source, url, note, type, options, error }] }]
  values: Object,     // current values (display units), keyed by field key
})
const emit = defineEmits(['update', 'reset', 'resetAll'])
const isChanged = (f) => props.values[f.key] != null && props.values[f.key] !== '' && props.values[f.key] !== f.default
const changedCount = (g) => g.fields.filter(isChanged).length
const anyChanged = () => props.groups.some((g) => changedCount(g) > 0)
const fmt = (f, v) => (f.percent ? `${num(v, 1).replace(/\.0$/, '')}%` : f.type === 'select'
  ? f.options.find((o) => o.value === v)?.label : f.type === 'text' ? v : num(v, f.step < 1 ? String(f.step).split('.')[1].length : 0))
const shown = (f) => props.values[f.key] ?? f.default
const outsideRange = (f) => f.low != null && f.high != null && typeof shown(f) === 'number' && (shown(f) < f.low || shown(f) > f.high)
const onInput = (f, e) => emit('update', f.key, e.target.value === '' ? null : Number(e.target.value))
</script>

<template>
  <section class="assumptions">
    <div class="head">
      <h2>Assumptions</h2>
      <button v-if="anyChanged()" type="button" class="link" @click="emit('resetAll')">Reset all</button>
    </div>
    <details v-for="g in groups" :key="g.title" class="group" :open="g.open">
      <summary>{{ g.title }}<span v-if="changedCount(g)" class="badge">{{ changedCount(g) }} changed</span></summary>
      <label v-for="f in g.fields" :key="f.key" :class="{ changed: isChanged(f) }">
        <span class="name" :title="f.note">{{ f.label }}<small v-if="f.unit"> ({{ f.unit }})</small></span>
        <span class="row">
          <select v-if="f.type === 'select'" :value="shown(f)" @change="emit('update', f.key, $event.target.value)">
            <option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <input v-else-if="f.type === 'text'" type="text" :value="shown(f)" @change="emit('update', f.key, $event.target.value.trim() || null)" />
          <input v-else type="number" :value="shown(f)" :step="f.step" :min="f.min" :max="f.max"
                 :class="{ outside: outsideRange(f) }" @input="onInput(f, $event)" />
          <button v-if="isChanged(f)" type="button" class="reset" title="Reset to default" @click="emit('reset', f.key)">↺</button>
        </span>
        <span v-if="f.error" class="err">{{ f.error }}</span>
        <span v-if="f.default != null" class="default">
          Default {{ fmt(f, f.default) }}<template v-if="f.source">:
            <a v-if="f.url" :href="f.url" target="_blank" rel="noopener">{{ f.source }}</a><template v-else>{{ f.source }}</template>
          </template>
        </span>
        <span v-if="f.low != null && f.high != null" class="default" :title="f.rangeSource">
          Typical range
          <button type="button" class="link" @click="emit('update', f.key, f.low)">{{ fmt(f, f.low) }}</button>–<button type="button" class="link" @click="emit('update', f.key, f.high)">{{ fmt(f, f.high) }}</button>
          <template v-if="f.rangeSource"> ({{ f.rangeSource }})</template>
        </span>
      </label>
    </details>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: baseline; }
h2 { font-size: 0.95rem; color: #2e3a8f; margin: 1rem 0 0.2rem; }
details.group { border-top: 1px solid #e6e5e1; padding: 0.2rem 0 0.4rem; }
summary { cursor: pointer; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.05em; color: #52514e; font-weight: 600; padding: 0.4rem 0; }
.badge { margin-left: 0.5rem; text-transform: none; letter-spacing: 0; font-weight: 400; color: #e8501c; }
.err { display: block; font-size: 0.72rem; color: #9e1f1a; }
input.outside { border-color: #e8501c; }
label { display: block; font-size: 0.82rem; color: #52514e; margin-bottom: 0.55rem; padding: 2px 4px; border-left: 3px solid transparent; }
label.changed { border-left-color: #e8501c; background: #fdf3ee; }
.name small { color: #7a7974; }
.row { display: flex; gap: 4px; margin-top: 0.15rem; }
input, select { flex: 1; min-width: 0; padding: 0.3rem 0.45rem; font: inherit; border: 1px solid #c9c7c0; border-radius: 4px; background: #fff; }
.default { display: block; font-size: 0.72rem; color: #7a7974; margin-top: 0.1rem; }
.default a { color: #7a7974; }
.reset { border: 1px solid #c9c7c0; background: #fff; border-radius: 4px; cursor: pointer; color: #e8501c; padding: 0 0.5rem; }
.link { border: 0; background: none; color: #2e3a8f; cursor: pointer; font: inherit; font-size: inherit; text-decoration: underline; padding: 0; }
.head .link { font-size: 0.8rem; }
</style>
