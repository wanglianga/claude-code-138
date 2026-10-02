<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import CrowdMeter from '@/components/CrowdMeter.vue'
import { hm2m, m2hm } from '@/utils/time'
import { useToast } from '@/composables/useToast'
import type { Closure } from '@/types'

const store = useMuseumStore()
const router = useRouter()
const { toast } = useToast()

const lanes = [
  { key: '团队通道A' as const, cap: 40, note: '常规团队口' },
  { key: '团队通道B' as const, cap: 40, note: '高峰备用团队口' },
  { key: '无障碍优先通道' as const, cap: 20, note: '轮椅 / 拐杖 / 婴儿车优先' }
]
const laneLoad = (key: '团队通道A' | '团队通道B' | '无障碍优先通道') =>
  store.LANE_BASE[key] +
  store.bookingList
    .filter((b) => ['已确认', '已到馆'].includes(b.status) && b.lane === key && (b.batchStart ?? 9999) <= store.now + 30)
    .reduce((n, b) => n + b.size, 0)

// 临时维护 / 闭展登记
const mOpen = ref(false)
const mHall = ref(store.hallList[0].id)
const mStart = ref(m2hm(store.now))
const mDur = ref(60)
const mReason = ref<Closure['reason']>('设备维护')

function openMaintenance(id: string) {
  mHall.value = id
  mOpen.value = true
}
function submitMaintenance() {
  const start = hm2m(mStart.value)
  store.reportMaintenance(mHall.value, start, start + mDur.value, mReason.value)
  mOpen.value = false
  toast('维护/闭展已登记，相关在场与计划团队已收到改道提示')
}

/** 拥堵/闭展影响到的在馆团队（快速分流入口） */
const impacted = computed(() => {
  const out: { b: ReturnType<typeof store.getBooking>; hallId: string; why: string }[] = []
  for (const b of store.bookingList) {
    if (b.status !== '讲解中') continue
    for (const s of b.route) {
      if (s.state !== '参观中' && s.state !== '计划' && s.state !== '拥堵改道') continue
      const h = store.hallById(s.hallId)
      if (store.closureActive(s.hallId)) out.push({ b, hallId: s.hallId, why: `${h?.name.replace(/^[一二三四]层·/, '')} 正在${store.closureActive(s.hallId)?.reason}` })
      else if (store.crowdOf(s.hallId).label === '拥堵')
        out.push({ b, hallId: s.hallId, why: `${h?.name.replace(/^[一二三四]层·/, '')} 拥堵 ${store.crowdOf(s.hallId).occ}/${h?.capacity}` })
    }
  }
  return out
})

const todayClosures = computed(() =>
  store.closureList.map((c) => ({ ...c, hall: store.hallById(c.hallId) }))
)

const teamInHall = (hallId: string) =>
  store.bookingList.filter((b) => b.route.some((s) => s.hallId === hallId && s.state === '参观中'))
</script>

<template>
  <div>
    <!-- 安检通道 -->
    <div class="grid cols-3 mb14">
      <div v-for="l in lanes" :key="l.key" class="card card-pad">
        <div class="flex-between">
          <h2 class="card-title" style="font-size: 14px">{{ l.key }}</h2>
          <span class="badge" :class="laneLoad(l.key) >= l.cap ? 'badge-bad' : laneLoad(l.key) >= l.cap * 0.7 ? 'badge-warn' : 'badge-ok'">
            {{ laneLoad(l.key) }}/{{ l.cap }}
          </span>
        </div>
        <div class="meter mt" style="margin-top: 10px">
          <i
            :class="laneLoad(l.key) >= l.cap ? 'fill-crowd' : laneLoad(l.key) >= l.cap * 0.7 ? 'fill-busy' : 'fill-loose'"
            :style="{ width: `${Math.min(100, (laneLoad(l.key) / l.cap) * 100)}%` }"
          />
        </div>
        <div class="small muted mt" style="margin-top: 8px">{{ l.note }} · 候场团队批次调整会在预约详情内完成</div>
      </div>
    </div>

    <!-- 分流告警 -->
    <section v-if="impacted.length" class="card card-pad mb14" style="border-color: #e3c3ba">
      <h2 class="card-title mb14">需要立即分流的团队</h2>
      <div class="alert-list">
        <div v-for="(it, i) in impacted" :key="i" class="alert alert-warn flex-between wrap">
          <span>
            <b>{{ it.b?.id }} {{ it.b?.orgName }}</b>（{{ it.b?.actualSize?.total ?? it.b?.size }} 人，讲解 {{ store.guideById(it.b?.guideId)?.name }}）—— {{ it.why }}
          </span>
          <button class="btn btn-sm btn-primary" @click="router.push(`/bookings/${it.b?.id}`)">去该预约改道 / 顺延</button>
        </div>
      </div>
    </section>

    <div class="grid cols-2 mb14">
      <!-- 展厅网格 -->
      <section class="card card-pad">
        <div class="flex-between mb14">
          <h2 class="card-title">展厅分流图（儿童适宜 · 禁拍 · 维护一目了然）</h2>
        </div>
        <div class="grid cols-2">
          <div v-for="h in store.hallList" :key="h.id" class="card" style="padding: 12px 13px; box-shadow: none">
            <div class="flex-between">
              <b style="font-size: 13.5px">{{ h.name }}</b>
              <span class="chip" :class="h.status === '开放' ? 'access' : 'closed'">{{ h.status }}</span>
            </div>
            <div class="flex wrap" style="margin: 7px 0; gap: 4px">
              <span v-if="h.childFriendly" class="chip kid">适合儿童</span>
              <span v-if="h.quiet" class="chip quiet">安静展区</span>
              <span v-if="h.accessible" class="chip access">无障碍</span>
              <span v-else class="chip closed">仅楼梯</span>
            </div>
            <CrowdMeter :hall="h" />
            <div class="small" style="margin-top: 8px; line-height: 1.9">
              <div v-for="e in store.exhibitsOf(h.id)" :key="e.id">
                <span v-if="e.hot" style="color: var(--cinnabar); font-weight: 600">★ {{ e.name }}</span>
                <span v-if="e.noPhoto" :style="e.hot ? 'margin-left:8px' : ''">📷 禁止拍照</span>
                <span v-if="e.note" class="muted" style="margin-left: 6px">{{ e.note }}</span>
              </div>
            </div>
            <div v-if="teamInHall(h.id).length" class="small" style="margin-top: 6px; color: var(--jade)">
              在内团队：{{ teamInHall(h.id).map((b) => `${b.orgName}`).join('、') }}
            </div>
            <div class="flex" style="margin-top: 9px">
              <button class="btn btn-sm" @click="openMaintenance(h.id)">登记临时维护/闭展</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 闭展安排 + 调整原则 -->
      <section class="grid" style="align-content: start">
        <div class="card card-pad">
          <h2 class="card-title mb14">今日闭展 / 维护安排</h2>
          <table class="table">
            <thead><tr><th>展厅</th><th>时段</th><th>原因</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="c in todayClosures" :key="c.id">
                <td>{{ c.hall?.name.replace(/^[一二三四]层·/, '') }}</td>
                <td>{{ m2hm(c.start) }}–{{ m2hm(c.end) }}</td>
                <td>{{ c.reason }}</td>
                <td>
                  <span class="badge" :class="store.now >= c.start && store.now < c.end ? 'badge-bad' : store.now < c.start ? 'badge-warn' : 'badge-outline'">
                    {{ store.now >= c.start && store.now < c.end ? '进行中' : store.now < c.start ? '未开始' : '已结束' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card card-pad">
          <h2 class="card-title mb14">分流调整原则（兼顾安静观展与团队体验）</h2>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; line-height: 2; color: var(--ink-2)">
            <li>安静展厅达容量 70% 即触发错峰，普通展厅阈值 85%。</li>
            <li>儿童团优先改道「适合儿童」展厅，减少在书画/特展等安静厅聚集。</li>
            <li>含禁拍名品的展厅改道时同步提示领队，避免折返拥堵。</li>
            <li>无障碍团只在全程可达展厅间调整，自动排除仅楼梯可达的陶瓷阁。</li>
            <li>每次调整都会顺延同通道后续团队批次，并完整记录决策前后方案与容量快照。</li>
          </ul>
        </div>
      </section>
    </div>

    <!-- 维护弹层 -->
    <div v-if="mOpen" class="modal-mask" @click.self="mOpen = false">
      <div class="modal card">
        <h3 class="card-title mb14">登记临时维护 / 闭展</h3>
        <div class="field">
          <label>展厅</label>
          <select v-model="mHall" class="select">
            <option v-for="h in store.hallList" :key="h.id" :value="h.id">{{ h.name }}</option>
          </select>
        </div>
        <div class="inline-fields">
          <div class="field">
            <label>开始时间</label>
            <input v-model="mStart" class="input" type="time" />
          </div>
          <div class="field">
            <label>持续（分钟）</label>
            <select v-model.number="mDur" class="select">
              <option :value="30">30 分钟</option>
              <option :value="60">1 小时</option>
              <option :value="90">1.5 小时</option>
              <option :value="120">2 小时</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>原因</label>
          <select v-model="mReason" class="select">
            <option>设备维护</option>
            <option>展品轮换</option>
            <option>临时闭展</option>
          </select>
        </div>
        <div class="alert alert-warn">提交后：当前/计划进入该厅的团队时间线将收到改道提示，可在其预约详情内一键重排路线。</div>
        <div class="flex mt14">
          <button class="btn btn-primary" @click="submitMaintenance">提交并通知调度</button>
          <button class="btn" @click="mOpen = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(43, 38, 32, 0.42);
  display: grid;
  place-items: center;
  z-index: 50;
  padding: 20px;
}
.modal {
  width: min(520px, 100%);
  padding: 20px 22px;
}
</style>
