<script setup lang="ts">
import { computed } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Hall } from '@/types'

const props = defineProps<{ hall: Hall; at?: number }>()
const store = useMuseumStore()

const crowd = computed(() => store.crowdOf(props.hall.id, props.at))
const fillClass = computed(() => {
  if (crowd.value.label === '关闭') return 'fill-off'
  if (crowd.value.ratio >= (props.hall.quiet ? 0.7 : 0.85)) return 'fill-crowd'
  if (crowd.value.ratio >= 0.6) return 'fill-busy'
  if (crowd.value.ratio >= 0.35) return 'fill-ok'
  return 'fill-loose'
})
const labelClass = computed(() => {
  if (crowd.value.label === '关闭') return 'chip closed'
  if (crowd.value.label === '拥堵') return 'badge badge-bad'
  if (crowd.value.label === '较挤') return 'badge badge-warn'
  if (crowd.value.label === '正常') return 'badge badge-neutral'
  return 'badge badge-ok'
})
</script>

<template>
  <div>
    <div class="flex-between small mb">
      <span class="muted">实时客流</span>
      <span :class="labelClass">{{ crowd.label }}</span>
    </div>
    <div class="meter">
      <i :class="fillClass" :style="{ width: crowd.label === '关闭' ? '100%' : `${Math.min(100, Math.round(crowd.ratio * 100))}%` }" />
    </div>
    <div class="small muted mt" style="margin-top: 4px">
      {{ crowd.label === '关闭' ? '暂停开放' : `${crowd.occ}/${hall.capacity} 人` }}
      <span v-if="hall.quiet">· 安静厅阈值 {{ Math.round(hall.capacity * 0.7) }} 人</span>
    </div>
  </div>
</template>
