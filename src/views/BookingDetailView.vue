<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import StatusBadge from '@/components/StatusBadge.vue'
import RouteFlow from '@/components/RouteFlow.vue'
import TimelineView from '@/components/TimelineView.vue'
import ConfirmPanel from '@/components/panels/ConfirmPanel.vue'
import ArrivalPanel from '@/components/panels/ArrivalPanel.vue'
import GuidingPanel from '@/components/panels/GuidingPanel.vue'
import DevicePanel from '@/components/panels/DevicePanel.vue'
import CheckoutPanel from '@/components/panels/CheckoutPanel.vue'
import { m2hm } from '@/utils/time'

const props = defineProps<{ id: string }>()
const router = useRouter()
const store = useMuseumStore()

const b = computed(() => store.getBooking(props.id))
const ageText = computed(() =>
  Object.entries(b.value?.ageLayers ?? {}).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' / ')
)
const traceKinds = computed(() => {
  if (!b.value?.complaint) return []
  const c = b.value.complaint.type
  if (c === '讲解缩水') return ['团体迟到', '入馆批次', '讲解员变更', '路线调整', '拥堵分流', '展厅维护', '到达展厅', '完成展厅']
  return ['团体迟到', '入馆批次', '系统提示', '拥堵分流']
})
</script>

<template>
  <div v-if="b">
    <div class="flex-between mb14 wrap">
      <div class="flex">
        <button class="btn btn-sm" @click="router.push('/bookings')">← 返回列表</button>
        <h2 style="font-size: 19px">
          {{ b.orgName }} <span class="muted" style="font-size: 14px; font-family: var(--sans)">{{ b.id }} · {{ b.orgType }}</span>
        </h2>
        <StatusBadge :status="b.status" />
        <span v-if="b.complaint" class="badge" :class="b.complaint.resolved ? 'badge-neutral' : 'badge-bad'">
          {{ b.complaint.resolved ? '投诉已结' : '投诉待处理' }}
        </span>
      </div>
      <div class="small muted">
        计划到馆 {{ m2hm(b.arriveAt) }}<span v-if="b.actualArrive"> · 实际 {{ m2hm(b.actualArrive) }}</span> · 主题 {{ b.theme }}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 14px; align-items: start">
      <div class="grid" style="gap: 14px">
        <!-- 驳回原因 -->
        <div v-if="b.status === '已驳回'" class="alert alert-block">该预约已驳回：{{ b.rejectReason }}</div>

        <!-- 待确认 -->
        <ConfirmPanel v-if="b.status === '待确认'" :booking="b" />

        <!-- 已确认 / 已到馆 -->
        <template v-if="b.status === '已确认' || b.status === '已到馆'">
          <section class="card card-pad">
            <h2 class="card-title mb14">确认排班方案</h2>
            <div class="grid cols-3" style="gap: 10px">
              <div class="kv" style="grid-template-columns: 74px 1fr">
                <dt>讲解员</dt><dd>{{ store.guideById(b.guideId)?.name }}（{{ store.guideById(b.guideId)?.title }}）</dd>
                <dt>批次</dt><dd>{{ b.lane }} {{ m2hm(b.batchStart ?? 0) }}<span v-if="b.batches && b.batches.length > 1"> · 共 {{ b.batches.length }} 批</span></dd>
                <dt>时长</dt><dd>计划 {{ b.plannedDuration }} 分钟</dd>
              </div>
              <div style="grid-column: span 2">
                <RouteFlow :booking="b" />
              </div>
            </div>
          </section>
          <ArrivalPanel :booking="b" />
        </template>

        <!-- 讲解中 -->
        <template v-if="b.status === '讲解中'">
          <GuidingPanel :booking="b" />
          <DevicePanel :booking="b" />
          <CheckoutPanel :booking="b" />
        </template>

        <!-- 已离馆 -->
        <template v-if="b.status === '已离馆'">
          <CheckoutPanel :booking="b" />
          <DevicePanel :booking="b" />
          <section class="card card-pad">
            <h2 class="card-title mb14">最终参观路线</h2>
            <RouteFlow :booking="b" />
          </section>
        </template>
      </div>

      <!-- 右栏：档案 + 溯源时间线 -->
      <div style="position: sticky; top: 16px; display: grid; gap: 14px">
        <section class="card card-pad">
          <h2 class="card-title mb14">团体档案</h2>
          <dl class="kv">
            <dt>人数</dt><dd>{{ b.size }} 人<span v-if="b.actualSize"> · 实到 {{ b.actualSize.total }}</span></dd>
            <dt>年龄层</dt><dd>{{ ageText }}</dd>
            <dt>语言</dt><dd>{{ b.lang }}</dd>
            <dt>无障碍</dt><dd>{{ b.accessible ? '需要（坡道/电梯）' : '不需要' }}</dd>
            <dt>联系人</dt><dd>{{ b.contactName }} · {{ b.contactPhone }}</dd>
            <dt>车辆</dt><dd>{{ b.busCount }} 辆 · {{ b.dockSpot }}</dd>
            <dt>耳麦</dt><dd>{{ b.needHeadsets ? `借用 ${b.headsetNeeded} 台 · ¥${b.depositPer}/台` : '不借用' }}</dd>
          </dl>
          <div v-if="b.note" class="alert alert-info mt14" style="font-size: 12px">{{ b.note }}</div>
        </section>

        <section class="card card-pad">
          <div class="flex-between mb14">
            <h2 class="card-title">全流程时间线</h2>
            <span class="small muted">{{ store.eventsOf(b.id).length }} 条记录</span>
          </div>
          <div v-if="b.complaint" class="alert alert-bad alert-block mb14" style="font-size: 12px">
            <b>投诉溯源视图</b>：下方记录完整保留到馆时间、分流决策（划线旧方案 → 新方案）、讲解员变更、展厅容量快照与设备借还。
            <div class="small" style="margin-top: 5px">重点关注：{{ traceKinds.join('、') }}</div>
          </div>
          <TimelineView :booking-id="b.id" />
        </section>
      </div>
    </div>
  </div>
  <div v-else class="card card-pad empty">未找到预约 <router-link to="/bookings">返回列表</router-link></div>
</template>
