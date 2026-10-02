<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Booking, Lane, RouteStop } from '@/types'
import { LANES } from '@/types'
import { ENTRY_SLOT } from '@/config'
import { m2hm } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()
const { toast } = useToast()

const suggested = store.suggestPlan(props.booking)
const form = reactive({
  guideId: suggested.guideId,
  batchStart: suggested.batchStart,
  lane: suggested.lane as Lane
})
const route = computed<RouteStop[]>(() => store.buildRoute(props.booking, form.batchStart))
const plannedDuration = computed(() => store.routeDuration(route.value))

const rejecting = ref(false)
const rejectReason = ref('')

const endAt = computed(() => form.batchStart + plannedDuration.value)

const plan = computed(() => ({
  guideId: form.guideId,
  batchStart: form.batchStart,
  lane: form.lane,
  route: route.value,
  plannedDuration: plannedDuration.value
}))

const issues = computed(() => store.evaluate(props.booking, plan.value))
const blocks = computed(() => issues.value.filter((i) => i.level === 'block'))

const guideRows = computed(() =>
  store.guideList.map((g) => ({
    g,
    reason: store.guideAvailable(g, form.batchStart, endAt.value, props.booking)
  }))
)

const slots: number[] = []
for (let m = Math.ceil((props.booking.arriveAt + 5) / ENTRY_SLOT) * ENTRY_SLOT; m <= 13 * 60; m += ENTRY_SLOT) slots.push(m)

function doConfirm() {
  if (blocks.value.length) {
    toast('仍存在阻断项，请更换讲解员 / 批次 / 路线后再确认')
    return
  }
  store.confirm(props.booking.id, plan.value)
  toast('预约已确认，已通知讲解员与前台')
}
function doReject() {
  if (!rejectReason.value.trim()) {
    toast('请填写驳回原因')
    return
  }
  store.reject(props.booking.id, rejectReason.value.trim())
  toast('已驳回并记录原因')
  rejecting.value = false
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="card-title mb14">工作人员确认校核</h2>

    <div class="inline-fields">
      <div class="field">
        <label>讲解员（按语言 / 主题 / 排班 / 时段自动推荐）</label>
        <select v-model="form.guideId" class="select">
          <option v-for="r in guideRows" :key="r.g.id" :value="r.g.id">
            {{ r.g.name }} · {{ r.g.title }} · {{ r.g.langs.join('/') }}
            <template v-if="r.reason">（不可排：{{ r.reason }}）</template>
          </option>
        </select>
        <div v-if="guideRows.find((r) => r.g.id === form.guideId)?.reason" class="alert alert-block" style="margin-top: 6px">
          {{ guideRows.find((r) => r.g.id === form.guideId)?.reason }}
        </div>
      </div>
      <div class="field">
        <label>入馆批次开始时间</label>
        <select v-model="form.batchStart" class="select">
          <option v-for="s in slots" :key="s" :value="s">{{ m2hm(s) }}</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>安检通道</label>
      <div class="flex wrap">
        <label v-for="l in LANES" :key="l" class="switch" style="margin-right: 14px">
          <input type="radio" :value="l" v-model="form.lane" />
          {{ l }}
          <span class="small muted">
            排队约 {{ store.LANE_BASE[l] + (l === form.lane ? props.booking.size : 0) }}/{{ store.LANE_CAP[l] }}
          </span>
        </label>
      </div>
    </div>

    <div class="field">
      <label>建议路线（已自动避开闭展 / 不可达展厅）</label>
      <div class="route-flow">
        <div v-for="(s, i) in route" :key="i" class="route-stop">
          <div class="rs-name">{{ store.hallById(s.hallId)?.name.replace(/^[一二三四]层·/, '') }}</div>
          <div class="rs-meta">{{ m2hm(s.plannedEnter) }} · {{ s.plannedDuration }} 分钟</div>
          <div class="flex wrap" style="margin-top: 5px; gap: 4px">
            <span v-if="store.hallById(s.hallId)?.childFriendly" class="chip kid">适合儿童</span>
            <span v-if="store.hallById(s.hallId)?.quiet" class="chip quiet">安静</span>
            <span v-if="store.exhibitsOf(s.hallId).some((e) => e.noPhoto)" class="chip closed">📷 禁拍</span>
            <span v-if="store.projectedBase(s.hallId, s.plannedEnter) / (store.hallById(s.hallId)?.capacity ?? 1) >= 0.7" class="badge badge-warn">
              预计较挤 {{ store.projectedBase(s.hallId, s.plannedEnter) }}/{{ store.hallById(s.hallId)?.capacity }}
            </span>
          </div>
        </div>
      </div>
      <div class="small muted mt" style="margin-top: 6px">
        计划讲解总时长 {{ plannedDuration }} 分钟 · 大团将自动按 ≤30 人/批拆批，间隔 {{ ENTRY_SLOT }} 分钟
      </div>
    </div>

    <div class="alert-list">
      <div v-for="(i, idx) in issues" :key="idx" class="alert" :class="{
        'alert-block': i.level === 'block',
        'alert-warn': i.level === 'warn',
        'alert-ok': i.level === 'ok'
      }">
        <span>{{ i.level === 'block' ? '✕' : i.level === 'warn' ? '⚠' : '✓' }}</span>
        <span>{{ i.text }}</span>
      </div>
    </div>

    <div class="divider" />
    <div class="flex">
      <button class="btn btn-jade" :disabled="blocks.length > 0" @click="doConfirm">确认预约并排班</button>
      <button v-if="!rejecting" class="btn danger-text" @click="rejecting = true">驳回</button>
      <template v-else>
        <input v-model="rejectReason" class="input grow" placeholder="驳回原因（容量不足 / 闭展 / 排班已满…）" />
        <button class="btn btn-primary" @click="doReject">提交驳回</button>
        <button class="btn" @click="rejecting = false">取消</button>
      </template>
    </div>
  </section>
</template>
