<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import StatusBadge from '@/components/StatusBadge.vue'
import CrowdMeter from '@/components/CrowdMeter.vue'
import { m2hm, dur } from '@/utils/time'

const router = useRouter()
const store = useMuseumStore()

const stats = computed(() => [
  { label: '馆内团队访客', value: store.inMuseumVisitors, unit: '人', trend: `${store.guidingTeams.length} 团讲解中 · ${store.waitingTeams.length} 团候场` },
  { label: '耳麦可借 / 库存', value: `${store.headsetAvailable}/120`, unit: '台', trend: `在场设备押金 ¥${store.depositHeld.toLocaleString()}` },
  { label: '待确认预约', value: store.pending.length, unit: '单', trend: '需核对容量 · 排班 · 闭展', danger: store.pending.length > 0 },
  { label: '未结投诉', value: store.openComplaints.length, unit: '件', trend: '时间线可一键溯源', danger: store.openComplaints.length > 0 }
])

const inHouse = computed(() =>
  store.bookingList.filter((b) => ['讲解中', '已到馆'].includes(b.status)).sort((a, b) => (a.batchStart ?? 0) - (b.batchStart ?? 0))
)

const currentStop = (id: string) => store.getBooking(id)?.route.find((s) => s.state === '参观中')

const schedule = computed(() =>
  store.guideList.map((g) => {
    const now = store.guideBusyWindows(g)
    return {
      g,
      busy: now,
      onDuty: store.now >= g.dutyStart && store.now <= g.dutyEnd,
      busyNow: now.some((w) => store.now >= w.start && store.now < w.end)
    }
  })
)

function open(id: string) {
  router.push(`/bookings/${id}`)
}
</script>

<template>
  <div>
    <div class="grid cols-4 mb14">
      <div v-for="s in stats" :key="s.label" class="card stat">
        <div class="stat-label">{{ s.label }}</div>
        <div class="stat-value" :style="s.danger ? 'color:var(--cinnabar)' : ''">
          {{ s.value }}<span class="stat-unit">{{ s.unit }}</span>
        </div>
        <div class="stat-trend">{{ s.trend }}</div>
      </div>
    </div>

    <div class="grid cols-2 mb14">
      <!-- 展厅实况 -->
      <section class="card card-pad">
        <div class="flex-between mb14">
          <h2 class="card-title">展厅实时状况</h2>
          <router-link class="btn btn-sm" to="/dispatch">前往分流台 →</router-link>
        </div>
        <div class="grid cols-2">
          <div v-for="h in store.hallList" :key="h.id" class="card" style="padding: 12px 13px; box-shadow: none">
            <div class="flex-between">
              <div>
                <b style="font-size: 13.5px">{{ h.name }}</b>
                <div class="small muted">容量 {{ h.capacity }} 人</div>
              </div>
              <div class="flex wrap" style="justify-content: flex-end">
                <span v-if="h.status !== '开放'" class="chip closed">{{ h.status }}</span>
                <span v-if="h.childFriendly" class="chip kid">适合儿童</span>
                <span v-if="h.quiet" class="chip quiet">安静展区</span>
                <span v-if="h.accessible" class="chip access">无障碍</span>
                <span v-else class="chip closed">楼梯可达</span>
              </div>
            </div>
            <div style="margin: 9px 0">
              <CrowdMeter :hall="h" />
            </div>
            <div v-if="h.statusNote" class="alert alert-warn" style="padding: 6px 10px; font-size: 11.5px">
              {{ h.statusNote }}
            </div>
            <div class="small muted" style="margin-top: 7px">
              <template v-for="e in store.exhibitsOf(h.id)" :key="e.id">
                <span v-if="e.hot || e.noPhoto" style="margin-right: 10px; white-space: nowrap">
                  <b v-if="e.hot" style="color: var(--cinnabar)">★ {{ e.name }}</b>
                  <span v-if="e.noPhoto" :style="e.hot ? 'margin-left:8px' : ''">📷 禁拍</span>
                </span>
              </template>
            </div>
          </div>
        </div>
      </section>

      <!-- 在馆团队 -->
      <section class="card card-pad">
        <h2 class="card-title mb14">在馆 / 候场团体</h2>
        <div class="scroll-x">
          <table class="table">
            <thead>
              <tr>
                <th>团体</th>
                <th>状态</th>
                <th>讲解员</th>
                <th>批次/当前位置</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in inHouse" :key="b.id" class="clickable" @click="open(b.id)">
                <td>
                  <b>{{ b.orgName }}</b>
                  <div class="small muted">{{ b.id }} · {{ b.actualSize?.total ?? b.size }} 人 · {{ b.lang }} · {{ b.theme }}</div>
                </td>
                <td><StatusBadge :status="b.status" /></td>
                <td>{{ store.guideById(b.guideId)?.name ?? '—' }}</td>
                <td>
                  <template v-if="b.status === '讲解中'">
                    <span class="badge badge-ok">{{ store.hallById(currentStop(b.id)?.hallId ?? '')?.name ?? '—' }}</span>
                    <div class="small muted" style="margin-top: 2px">计划 {{ dur(b.plannedDuration ?? 0) }}</div>
                  </template>
                  <template v-else>
                    <span class="badge badge-warn">候场 {{ m2hm(b.batchStart ?? 0) }}</span>
                    <div class="small muted" style="margin-top: 2px">{{ b.lane }}</div>
                  </template>
                </td>
                <td><span class="btn btn-ghost btn-sm">调度</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="divider" />

        <h3 class="card-title mb14">讲解员排班（当班状态）</h3>
        <div class="grid cols-2">
          <div v-for="s in schedule" :key="s.g.id" class="flex-between" style="padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; background: #fffdf8">
            <div>
              <b style="font-size: 13px">{{ s.g.name }}</b>
              <div class="small muted">{{ s.g.title }} · {{ s.g.langs.join('/') }} · {{ m2hm(s.g.dutyStart) }}–{{ m2hm(s.g.dutyEnd) }}</div>
              <div v-if="s.busy.length" class="small" style="color: var(--warn-fg)">
                带团：{{ s.busy.map((w) => `${w.booking.id} ${m2hm(w.start)}-${m2hm(w.end)}`).join('；') }}
              </div>
            </div>
            <span class="badge" :class="s.busyNow ? 'badge-ok' : s.onDuty ? 'badge-neutral' : 'badge-outline'">
              {{ s.busyNow ? '带团中' : s.onDuty ? '当班空闲' : '未当班' }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <!-- 待确认 -->
    <section class="card card-pad">
      <div class="flex-between mb14">
        <h2 class="card-title">待确认预约（容量 / 热门展品 / 排班 / 安检 / 闭展联动校核）</h2>
        <router-link class="btn btn-sm" to="/bookings">全部预约 →</router-link>
      </div>
      <div v-if="!store.pending.length" class="empty">暂无待确认预约</div>
      <div v-else class="grid cols-2">
        <div v-for="b in store.pending" :key="b.id" class="card" style="padding: 13px 15px; box-shadow: none">
          <div class="flex-between">
            <div>
              <b>{{ b.orgName }}</b>
              <span class="small muted" style="margin-left: 8px">{{ b.id }} · {{ b.orgType }}</span>
            </div>
            <StatusBadge :status="b.status" />
          </div>
          <div class="small muted mt" style="margin-top: 6px">
            {{ b.size }} 人（{{ Object.entries(b.ageLayers).filter(([, n]) => n).map(([k, n]) => `${k}${n}`).join(' / ') }}）
            · {{ b.lang }} · {{ b.theme }} · 到馆 {{ m2hm(b.arriveAt) }}
          </div>
          <div class="small muted">{{ b.contactName }} {{ b.contactPhone }} · {{ b.dockSpot }} · {{ b.busCount }} 辆车 · 耳麦 {{ b.needHeadsets ? `${b.headsetNeeded} 台` : '不借' }}<span v-if="b.accessible"> · <span class="chip access">无障碍</span></span></div>
          <div class="flex" style="margin-top: 10px">
            <button class="btn btn-primary btn-sm" @click="open(b.id)">进入校核与确认</button>
            <span class="small muted">系统将自动给出讲解员、批次与建议路线</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
