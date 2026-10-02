<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ load: number; capacity: number; compact?: boolean }>()
const ratio = computed(() => (props.capacity ? props.load / props.capacity : 0))
const cls = computed(() => (ratio.value >= 1 ? 'full' : ratio.value >= 0.85 ? 'warn' : ''))
const pct = computed(() => Math.min(100, Math.round(ratio.value * 100)))
</script>

<template>
  <div class="capbar">
    <div class="track"><div class="fill" :class="cls" :style="{ width: pct + '%' }" /></div>
    <span class="num">{{ load }}/{{ capacity }}{{ compact ? '' : ` · ${pct}%` }}</span>
  </div>
</template>
