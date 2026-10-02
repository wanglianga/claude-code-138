<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import StatusBadge from '@/components/StatusBadge.vue'
import { m2hm } from '@/utils/time'
import type { BookingStatus } from '@/types'

const router = useRouter()
const store = useMuseumStore()

const filters: { key: BookingStatus | '全部'; label: string }[] = [
  { key: '全部', label: '全部' },
  { key: '待确认', label: '待确认' },
  { key: '已确认', label: '已确认' },
  { key: '已到馆', label: '已到馆' },
  { key: '讲解中', label: '讲解中' },
  { key: '已离馆', label: '已离馆' },
  { key: '已驳回', label: '已驳回' }
]
const active = ref<BookingStatus | '全部'>('全部')
const kw = ref('')

const list = computed(() =>
  store.bookingList
    .filter((b) => (active.value === '全部' ? true : b.status === active.value))
    .filter((b) => {
      if (!kw.value.trim()) return true
      const k = kw.value.trim()
      return b.orgName.includes(k) || b.id.includes(k) || b.contactName.includes(k)
    })
    .sort((a, b) => b.arriveAt - a.arriveAt || b.id.localeCompare(a.id))
)

/** 行内轻量预警：用于列表快速扫到风险点 */
function rowFlags(b: (typeof store.bookingList)[number]) {
  const flags: { text: string; cls: string }[] = []
  if (b.complaint) flags.push({ text: b.complaint.resolved ? '投诉已结' : '投诉待处理', cls: b.complaint.resolved ? 'badge-neutral' : 'badge-bad' })
  const kids = b.ageLayers.幼儿 + b.ageLayers.儿童
  if (kids > b.size / 2) flags.push({ text: '儿童团', cls: 'badge-warn' })
  if (b.accessible) flags.push({ text: '无障碍', cls: 'badge-neutral' })
  if (b.size >= 40) flags.push({ text: '大团拆批', cls: 'badge-warn' })
  if (b.headsets.some((h) => h.state === '损坏' || h.state === '遗失')) flags.push({ text: '设备异常', cls: 'badge-bad' })
  return flags
}
</script>

<template>
  <div>
    <div class="card card-pad mb14">
      <div class="flex-between wrap">
        <div class="filter-bar">
          <button
            v-for="f in filters"
            :key="f.key"
            class="btn btn-sm"
            :class="active === f.key ? 'btn-primary' : ''"
            @click="active = f.key"
          >
            {{ f.label }}
          </button>
        </div>
        <div class="flex">
          <input v-model="kw" class="input" style="width: 230px" placeholder="搜索团名 / 编号 / 联系人" />
          <router-link to="/bookings/new" class="btn btn-primary">＋ 新建团体预约</router-link>
        </div>
      </div>
    </div>

    <div class="card card-pad scroll-x">
      <table class="table">
        <thead>
          <tr>
            <th>编号 / 团体</th>
            <th>到馆</th>
            <th>人数与年龄层</th>
            <th>需求</th>
            <th>讲解员 / 批次</th>
            <th>状态</th>
            <th>标记</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in list" :key="b.id" class="clickable" @click="router.push(`/bookings/${b.id}`)">
            <td>
              <b>{{ b.orgName }}</b>
              <div class="small muted">{{ b.id }} · {{ b.orgType }} · {{ b.contactName }}</div>
            </td>
            <td>
              {{ m2hm(b.arriveAt) }}
              <div v-if="b.actualArrive" class="small" :style="b.actualArrive - b.arriveAt >= 5 ? 'color:var(--warn-fg)' : 'color:var(--ink-3)'">
                实到 {{ m2hm(b.actualArrive) }}
              </div>
            </td>
            <td>
              <b>{{ b.size }}</b> 人
              <div class="small muted">
                {{ Object.entries(b.ageLayers).filter(([, n]) => n).map(([k, n]) => `${k}${n}`).join(' ') || '—' }}
              </div>
            </td>
            <td class="small">
              <div>{{ b.lang }} · {{ b.theme }}</div>
              <div class="muted">{{ b.needHeadsets ? `耳麦 ${b.headsetNeeded}` : '不借耳麦' }} · {{ b.busCount }} 车</div>
            </td>
            <td class="small">
              <div>{{ store.guideById(b.guideId)?.name ?? '—' }}</div>
              <div class="muted">{{ b.batchStart ? `${b.lane} ${m2hm(b.batchStart)}` : '未排' }}</div>
            </td>
            <td><StatusBadge :status="b.status" /></td>
            <td>
              <div class="flex wrap" style="gap: 4px">
                <span v-for="(f, i) in rowFlags(b)" :key="i" class="badge" :class="f.cls">{{ f.text }}</span>
              </div>
            </td>
            <td><span class="btn btn-ghost btn-sm">详情 →</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!list.length" class="empty">没有符合条件的预约</div>
    </div>
  </div>
</template>
