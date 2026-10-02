<script setup lang="ts">
import { computed } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import { m2hm } from '@/utils/time'

const props = defineProps<{ bookingId: string; highlight?: string[] }>()
const store = useMuseumStore()

const events = computed(() => {
  const list = store.eventsOf(props.bookingId)
  return [...list].reverse() // 最新在上
})

const dotClass: Record<string, string> = { ok: 'tl-ok', warn: 'tl-warn', bad: 'tl-bad' }
</script>

<template>
  <div class="timeline">
    <div v-for="e in events" :key="e.id" class="tl-item" :class="dotClass[e.tag]">
      <div>
        <span class="tl-time">{{ m2hm(e.at) }}</span>
        <span class="tl-kind">{{ e.kind }}</span>
        <span v-if="e.guideId" class="tl-kind" style="background: rgba(58,90,124,.1); color: var(--blue)">
          {{ store.guideById(e.guideId)?.name }}
        </span>
        <span v-if="e.hallId" class="tl-kind" style="background: rgba(63,111,95,.12); color: var(--jade)">
          {{ store.hallById(e.hallId)?.name.replace(/^[一二三四]层·/, '') }}
        </span>
      </div>
      <div class="tl-title">{{ e.title }}</div>
      <div class="tl-detail">{{ e.detail }}</div>
      <div v-if="e.changeFrom || e.changeTo" class="tl-change">
        <span v-if="e.changeFrom" class="tl-from">{{ e.changeFrom }}</span>
        <span v-if="e.changeFrom && e.changeTo" class="tl-arrow">→</span>
        <span v-if="e.changeTo" class="tl-to">{{ e.changeTo }}</span>
        <span v-if="e.capacitySnapshot" class="tl-snap">容量快照 {{ e.capacitySnapshot }}</span>
      </div>
    </div>
  </div>
</template>
