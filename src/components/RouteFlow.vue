<script setup lang="ts">
import { computed } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Booking } from '@/types'
import { m2hm } from '@/utils/time'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()

const stops = computed(() => props.booking.route)
const stateLabel: Record<string, string> = {
  计划: 'badge-neutral',
  参观中: 'badge-bad',
  已完成: 'badge-ok',
  已跳过: 'badge-outline',
  拥堵改道: 'badge-warn'
}
</script>

<template>
  <div v-if="stops.length" class="route-flow">
    <div
      v-for="(s, i) in stops"
      :key="i"
      class="route-stop"
      :class="{ done: s.state === '已完成', active: s.state === '参观中', skip: s.state === '已跳过' || s.state === '拥堵改道' }"
    >
      <div class="flex-between">
        <span class="rs-name">{{ store.hallById(s.hallId)?.name.replace(/^[一二三四]层·/, '') }}</span>
        <span class="badge" :class="stateLabel[s.state]">{{ s.state === '拥堵改道' ? '待改道' : s.state }}</span>
      </div>
      <div class="rs-meta">
        计划 {{ m2hm(s.plannedEnter) }} · {{ s.plannedDuration }}分钟
        <template v-if="s.actualEnter"> / 实际 {{ m2hm(s.actualEnter) }}<template v-if="s.actualLeave">–{{ m2hm(s.actualLeave) }}</template></template>
      </div>
      <div class="flex wrap" style="margin-top: 5px; gap: 4px">
        <span v-if="store.hallById(s.hallId)?.childFriendly" class="chip kid">适合儿童</span>
        <span v-if="store.hallById(s.hallId)?.quiet" class="chip quiet">安静</span>
        <span v-if="store.hallById(s.hallId) && !store.hallById(s.hallId)!.accessible" class="chip closed">无电梯</span>
        <span v-if="store.exhibitsOf(s.hallId).some((e) => e.noPhoto)" class="chip closed">📷 禁拍展品</span>
        <span v-if="store.closureActive(s.hallId)" class="chip closed">维护中</span>
      </div>
      <div v-if="s.note" class="small" style="color: var(--warn-fg); margin-top: 5px">{{ s.note }}</div>
    </div>
  </div>
  <div v-else class="empty">尚未生成参观路线（确认预约时生成）</div>
</template>
