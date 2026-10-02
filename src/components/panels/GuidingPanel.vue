<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Booking, Guide, HeadsetUnit } from '@/types'
import { m2hm } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()
const { toast } = useToast()

// —— 路线编辑器 ——
const editing = ref(false)
const order = ref<string[]>([])

const remaining = computed(() => props.booking.route.filter((s) => s.state !== '已完成' && s.state !== '已跳过'))
const current = computed(() => props.booking.route.find((s) => s.state === '参观中'))
const completedCount = computed(() => props.booking.route.filter((s) => s.state === '已完成').length)

const editorAlts = computed(() =>
  store
    .alternativeHalls(props.booking)
    .filter((h) => !order.value.includes(h.id) && h.id !== current.value?.hallId && !props.booking.route.some((s) => s.state === '已完成' && s.hallId === h.id))
)

function startEdit() {
  order.value = remaining.value.filter((s) => !current.value || s.hallId !== current.value.hallId).map((s) => s.hallId)
  editing.value = true
}
function move(i: number, d: -1 | 1) {
  const j = i + d
  if (j < 0 || j >= order.value.length) return
  const t = order.value[i]
  order.value[i] = order.value[j]
  order.value[j] = t
}
function removeHall(id: string) {
  order.value = order.value.filter((x) => x !== id)
}
function addHall(id: string) {
  order.value.push(id)
}

const rerouteReason = ref<'crowd' | 'guest' | 'maintenance' | 'guide'>('crowd')
const reasonLabels = {
  crowd: '前方展厅拥堵，错峰改道',
  guest: '游客要求调整路线',
  maintenance: '展厅临时维护 / 闭展',
  guide: '讲解员替换后重排'
} as const

function applyReroute() {
  if (!order.value.length) {
    toast('请至少保留一个展厅，或改用「提前结束」')
    return
  }
  const ids = [...(current.value ? [current.value.hallId] : []), ...order.value]
  store.reroute(props.booking.id, ids, rerouteReason.value)
  editing.value = false
  toast('路线已调整：参观顺序、讲解时长与后续团队批次已联动')
}

// —— 展厅推进 ——
function completeAndEnter(hallId?: string) {
  if (current.value) store.completeCurrent(props.booking.id)
  if (hallId) store.enterHall(props.booking.id, hallId)
  toast(hallId ? `已转入 ${store.hallById(hallId)?.name.replace(/^[一二三四]层·/, '')}` : '当前展厅参观完成')
}

// —— 儿童走散 ——
const lostOpen = ref(false)
const lostHall = ref(current.value?.hallId ?? 'H2')
const lostDetail = ref('')
const lostMin = ref(6)
function reportLost() {
  if (!lostDetail.value.trim()) {
    toast('请描述走散与寻回经过')
    return
  }
  store.childLost(props.booking.id, lostHall.value, lostDetail.value.trim(), lostMin.value)
  lostOpen.value = false
  toast(`已登记走散事件，后续展厅顺延 ${lostMin.value} 分钟`)
}

// —— 讲解员替换 ——
const guideOpen = ref(false)
const newGuide = ref<Guide['id']>('')
const guideReason = ref('')
const candidateGuides = computed(() =>
  store.guideList
    .filter((g) => g.id !== props.booking.guideId)
    .map((g) => {
      const end = store.now + (props.booking.plannedDuration ?? 60)
      return { g, reason: store.guideAvailable(g, store.now, end, props.booking) }
    })
)
function doChangeGuide() {
  if (!newGuide.value || !guideReason.value.trim()) {
    toast('请选择新讲解员并填写原因')
    return
  }
  store.changeGuide(props.booking.id, newGuide.value, guideReason.value.trim())
  guideOpen.value = false
  toast('讲解员已替换，时间线已记录交接')
}

// —— 耳麦事故 ——
function accident(u: HeadsetUnit, state: '损坏' | '遗失') {
  const issue = state === '损坏'
    ? prompt('登记损坏情况（如：耳罩脱落 / 接收器无声 / 线材断裂）', '耳罩脱落、线材断裂')
    : prompt('登记遗失经过与查找结果', '团队清点时未找到，已现场复查无果')
  if (issue === null) return
  store.markHeadset(props.booking.id, u.code, state, issue || (state === '损坏' ? '设备损坏' : '设备遗失'))
  toast(state === '损坏' ? '已登记损坏，离馆将计维修费 ¥50' : '已登记遗失，离馆将从押金扣除 ¥300')
}

// —— 下游批次受影响团队 ——
const downstream = computed(() =>
  store.bookingList.filter(
    (b) =>
      b.id !== props.booking.id &&
      ['已确认', '已到馆'].includes(b.status) &&
      b.lane === props.booking.lane &&
      (b.batchStart ?? 0) >= store.now
  )
)

const hallCrowd = (id: string) => store.crowdOf(id)
</script>

<template>
  <section class="card card-pad">
    <div class="flex-between mb14 wrap">
      <h2 class="card-title">讲解途中调度（同一预约内联动）</h2>
      <div class="flex wrap">
        <button v-if="!editing" class="btn btn-sm" @click="startEdit">调整参观顺序 / 改路线</button>
        <button class="btn btn-sm" style="color: var(--bad-fg)" @click="lostOpen = true">登记儿童走散</button>
        <button class="btn btn-sm" @click="guideOpen = true">讲解员临时替换</button>
      </div>
    </div>

    <!-- 当前路线实况 -->
    <div v-if="!editing" class="route-flow" style="margin-bottom: 14px">
      <div
        v-for="s in booking.route"
        :key="s.hallId"
        class="route-stop"
        :class="{ done: s.state === '已完成', active: s.state === '参观中', skip: s.state === '已跳过' || s.state === '拥堵改道' }"
      >
        <div class="flex-between">
          <span class="rs-name">{{ store.hallById(s.hallId)?.name.replace(/^[一二三四]层·/, '') }}</span>
          <span
            class="badge"
            :class="{
              'badge-ok': s.state === '已完成',
              'badge-bad': s.state === '参观中',
              'badge-warn': s.state === '拥堵改道',
              'badge-outline': s.state === '已跳过',
              'badge-neutral': s.state === '计划'
            }"
          >{{ s.state === '拥堵改道' ? '待改道' : s.state }}</span>
        </div>
        <div class="rs-meta">
          计划 {{ m2hm(s.plannedEnter) }} · {{ s.plannedDuration }}′
          <template v-if="s.actualEnter"> / 实到 {{ m2hm(s.actualEnter) }}</template>
        </div>
        <div class="flex wrap" style="gap: 4px; margin-top: 5px">
          <span v-if="store.hallById(s.hallId)?.childFriendly" class="chip kid">适合儿童</span>
          <span v-if="store.hallById(s.hallId)?.quiet" class="chip quiet">安静</span>
          <span v-if="store.exhibitsOf(s.hallId).some((e) => e.noPhoto)" class="chip closed">📷 禁拍</span>
          <span v-if="store.closureActive(s.hallId)" class="chip closed">维护中</span>
          <span
            v-if="s.state !== '已完成' && s.state !== '已跳过'"
            class="badge"
            :class="{
              'badge-bad': hallCrowd(s.hallId).label === '拥堵',
              'badge-warn': hallCrowd(s.hallId).label === '较挤',
              'badge-ok': hallCrowd(s.hallId).label === '宽松' || hallCrowd(s.hallId).label === '正常'
            }"
            style="margin-left: 2px"
          >
            {{ hallCrowd(s.hallId).label }} {{ hallCrowd(s.hallId).occ }}/{{ store.hallById(s.hallId)?.capacity }}
          </span>
        </div>
        <div v-if="s.note" class="small" style="color: var(--warn-fg); margin-top: 4px">{{ s.note }}</div>
        <div v-if="s.state === '参观中'" style="margin-top: 8px">
          <button class="btn btn-jade btn-sm" @click="completeAndEnter(remaining.find((r) => r.hallId !== s.hallId)?.hallId)">
            完成本厅 → 进入下一厅
          </button>
        </div>
        <div v-else-if="s.state === '计划' || s.state === '拥堵改道'" style="margin-top: 8px">
          <button v-if="!current" class="btn btn-sm" @click="completeAndEnter(s.hallId)">现在进入此厅</button>
        </div>
      </div>
    </div>

    <!-- 路线编辑器 -->
    <div v-else class="card" style="padding: 14px; box-shadow: none; background: #fffdf8">
      <div class="field">
        <label>调整原因（将写入时间线，供投诉溯源）</label>
        <div class="flex wrap">
          <label v-for="(label, key) in reasonLabels" :key="key" class="switch" style="margin-right: 16px">
            <input type="radio" :value="key" v-model="rerouteReason" />
            {{ label }}
          </label>
        </div>
      </div>
      <label class="small muted">剩余展厅顺序（↑↓ 调整，✕ 跳过该厅）——选择时可看到儿童适宜 / 禁拍 / 维护 / 实时客流</label>
      <div style="margin: 8px 0" class="grid cols-2">
        <div v-for="(id, i) in order" :key="id" class="flex-between" style="border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; background: var(--paper-2)">
          <div>
            <b style="font-size: 13px">{{ i + 1 }}. {{ store.hallById(id)?.name.replace(/^[一二三四]层·/, '') }}</b>
            <div class="small">
              <span v-if="store.hallById(id)?.childFriendly" class="chip kid">适合儿童</span>
              <span v-if="store.hallById(id)?.quiet" class="chip quiet">安静</span>
              <span v-if="store.exhibitsOf(id).some((e) => e.noPhoto)" class="chip closed">📷 禁拍</span>
              <span v-if="store.closureActive(id)" class="chip closed">维护 {{ m2hm(store.now) }}</span>
              <span class="muted" style="margin-left: 4px">
                客流 {{ hallCrowd(id).label }}（{{ hallCrowd(id).occ }}/{{ store.hallById(id)?.capacity }}）
              </span>
            </div>
          </div>
          <div class="flex">
            <button class="btn btn-sm" :disabled="i === 0" @click="move(i, -1)">↑</button>
            <button class="btn btn-sm" :disabled="i === order.length - 1" @click="move(i, 1)">↓</button>
            <button class="btn btn-sm danger-text" @click="removeHall(id)">✕</button>
          </div>
        </div>
      </div>
      <div v-if="editorAlts.length" class="field">
        <label>加入备选展厅（开放、可达、当前不拥堵）</label>
        <div class="flex wrap">
          <button v-for="h in editorAlts" :key="h.id" class="btn btn-sm" @click="addHall(h.id)">
            ＋ {{ h.name.replace(/^[一二三四]层·/, '') }}
            <span class="muted">· {{ hallCrowd(h.id).occ }}/{{ h.capacity }}</span>
          </button>
        </div>
      </div>
      <div class="small muted mb14">
        已完成 {{ completedCount }} 厅保持不变；应用后将重算讲解时长，并自动顺延同通道后续团队的入场时隙。
      </div>
      <div class="flex">
        <button class="btn btn-primary" @click="applyReroute">应用路线调整并联动下游</button>
        <button class="btn" @click="editing = false">取消</button>
      </div>
    </div>

    <!-- 耳麦事故快捷入口 -->
    <div class="divider" />
    <h3 class="card-title mb14">讲解耳麦实时状态（{{ booking.headsets.filter((h) => h.state === '已发').length }} 台在用）</h3>
    <div v-if="booking.headsets.length" class="flex wrap" style="gap: 6px">
      <div
        v-for="u in booking.headsets"
        :key="u.code"
        class="flex"
        style="border: 1px solid var(--line); border-radius: 8px; padding: 4px 8px; gap: 6px; background: #fffdf8"
        :title="u.issue ?? ''"
      >
        <span class="small">{{ u.code }}</span>
        <span class="badge" :class="u.state === '已发' ? 'badge-ok' : u.state === '已还' ? 'badge-neutral' : 'badge-bad'">{{ u.state }}</span>
        <button v-if="u.state === '已发'" class="btn btn-sm danger-text" @click="accident(u, '损坏')">损坏</button>
        <button v-if="u.state === '已发'" class="btn btn-sm danger-text" @click="accident(u, '遗失')">遗失</button>
      </div>
    </div>
    <div v-else class="small muted">该团未借用耳麦。</div>

    <!-- 下游联动 -->
    <div class="divider" />
    <h3 class="card-title mb14">同通道后续团队（入场时隙联动预览）</h3>
    <div v-if="downstream.length" class="alert-list">
      <div v-for="b in downstream" :key="b.id" class="alert" :class="(b.batchStart ?? 0) < store.now + 45 ? 'alert-warn' : 'alert-info'">
        <b>{{ b.id }} {{ b.orgName }}</b>（{{ b.size }} 人）计划 {{ m2hm(b.batchStart ?? 0) }} 走 {{ b.lane }}
        <span v-if="(b.batchStart ?? 0) < store.now + 45">——与本团时距不足 45 分钟，路线一旦延长将自动顺延该团批次并通知前台。</span>
      </div>
    </div>
    <div v-else class="small muted">同通道暂无候场团队，本次调整不影响其他团体入场。</div>

    <!-- 走散弹层 -->
    <div v-if="lostOpen" class="modal-mask" @click.self="lostOpen = false">
      <div class="modal card">
        <h3 class="card-title mb14">登记儿童走散 / 寻回</h3>
        <div class="field">
          <label>发生展厅</label>
          <select v-model="lostHall" class="select">
            <option v-for="h in store.hallList" :key="h.id" :value="h.id">{{ h.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>经过与寻回情况</label>
          <textarea v-model="lostDetail" class="textarea" placeholder="如：9 岁男童在雕塑庭院脱队前往文创柜，保安 6 分钟后寻回，全员安全"></textarea>
        </div>
        <div class="field">
          <label>处置耗时（分钟，后续展厅与下游批次将顺延）</label>
          <input v-model.number="lostMin" type="number" min="1" max="60" class="input" style="width: 120px" />
        </div>
        <div class="flex">
          <button class="btn btn-primary" @click="reportLost">提交登记</button>
          <button class="btn" @click="lostOpen = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 换讲解弹层 -->
    <div v-if="guideOpen" class="modal-mask" @click.self="guideOpen = false">
      <div class="modal card">
        <h3 class="card-title mb14">讲解员临时替换</h3>
        <div class="field">
          <label>改派讲解员（校验语言 / 主题 / 当班 / 时段）</label>
          <select v-model="newGuide" class="select">
            <option value="" disabled>请选择</option>
            <option v-for="r in candidateGuides" :key="r.g.id" :value="r.g.id">
              {{ r.g.name }} · {{ r.g.title }} · {{ r.g.langs.join('/') }}
              <template v-if="r.reason">（{{ r.reason }}）</template>
            </option>
          </select>
        </div>
        <div class="field">
          <label>替换原因</label>
          <input v-model="guideReason" class="input" placeholder="如：突发咽喉不适 / 排班调整 / 语言应急" />
        </div>
        <div class="flex">
          <button class="btn btn-primary" @click="doChangeGuide">完成替换与交接</button>
          <button class="btn" @click="guideOpen = false">取消</button>
        </div>
      </div>
    </div>
  </section>
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
  width: min(560px, 100%);
  padding: 20px 22px;
  max-height: 86vh;
  overflow: auto;
}
</style>
