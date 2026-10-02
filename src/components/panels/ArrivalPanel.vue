<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Booking, Lane } from '@/types'
import { LANES } from '@/types'
import { ENTRY_SLOT } from '@/config'
import { m2hm } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()
const { toast } = useToast()

const adults = ref(props.booking.ageLayers.成人 + props.booking.ageLayers.长者)
const children = ref(props.booking.ageLayers.幼儿 + props.booking.ageLayers.儿童 + props.booking.ageLayers.青少年)
const secNote = ref('')
const hsCount = ref(props.booking.headsetNeeded)
const batchAt = ref(props.booking.batchStart ?? store.now + 5)
const lane = ref<Lane>((props.booking.lane ?? '团队通道A') as Lane)

const diff = computed(() => store.now - props.booking.arriveAt)
const sizeDiff = computed(() => adults.value + children.value - props.booking.size)

const slotList: number[] = []
for (let m = Math.ceil(store.now / ENTRY_SLOT) * ENTRY_SLOT; m <= store.now + 120; m += ENTRY_SLOT) slotList.push(m)

function doArrive() {
  if (adults.value + children.value < 1) {
    toast('请填写实到人数')
    return
  }
  store.arrive(props.booking.id, adults.value, children.value, secNote.value)
  toast('到馆核验完成')
}
function doIssue() {
  if (hsCount.value > store.headsetAvailable) {
    toast(`可借库存仅 ${store.headsetAvailable} 台`)
    return
  }
  store.issueHeadsets(props.booking.id, hsCount.value)
  toast(`已发放 ${hsCount.value} 台耳麦，押金 ¥${(hsCount.value * props.booking.depositPer).toLocaleString()}`)
}
function doBatch() {
  store.setBatch(props.booking.id, batchAt.value, lane.value)
  toast('批次已调整并通知候场')
}
function doAdmit() {
  if (!props.booking.headsets.length && props.booking.needHeadsets) {
    toast('请先发放耳麦')
    return
  }
  store.admit(props.booking.id)
  toast('已入馆，开始讲解')
}

const laneLoad = (l: Lane) =>
  store.LANE_BASE[l] +
  store.bookingList
    .filter((b) => b.id !== props.booking.id && ['已确认', '已到馆'].includes(b.status) && b.lane === l)
    .reduce((n, b) => n + b.size, 0)
</script>

<template>
  <section class="card card-pad">
    <h2 class="card-title mb14">前台到馆核验 · 设备发放 · 入馆批次</h2>

    <div v-if="!booking.actualArrive" class="alert-list mb14">
      <div class="alert" :class="diff >= 5 ? 'alert-warn' : 'alert-ok'">
        {{ diff >= 5 ? `该团已晚到 ${diff} 分钟（计划 ${m2hm(booking.arriveAt)}），后续批次可能需要顺延。` : `按计划时段到馆（计划 ${m2hm(booking.arriveAt)}）。` }}
      </div>
    </div>

    <!-- 核验 -->
    <div v-if="!booking.actualArrive">
      <div class="inline-fields">
        <div class="field">
          <label>实到成人（含长者）</label>
          <input v-model.number="adults" type="number" min="0" class="input" />
        </div>
        <div class="field">
          <label>实到儿童 / 学生</label>
          <input v-model.number="children" type="number" min="0" class="input" />
        </div>
      </div>
      <div class="field">
        <label>安检 / 车辆停靠核验备注</label>
        <input v-model="secNote" class="input" :placeholder="`${booking.dockSpot}；轮椅、随行物资等`" />
      </div>
      <div class="small mb14" :style="sizeDiff !== 0 ? 'color:var(--warn-fg)' : 'color:var(--ink-3)'">
        实到合计 {{ adults + children }} 人，与预约 {{ booking.size }} 人{{ sizeDiff === 0 ? '一致' : `相差 ${sizeDiff > 0 ? '+' : ''}${sizeDiff} 人` }}
      </div>
      <button class="btn btn-primary mb14" @click="doArrive">确认到馆核验</button>
    </div>
    <div v-else class="alert alert-ok mb14">
      ✓ {{ m2hm(booking.actualArrive) }} 已核验：实到 {{ booking.actualSize?.total }} 人（成人 {{ booking.actualSize?.adults }} / 儿童 {{ booking.actualSize?.children }}）
      <span v-if="booking.securityNote"> · {{ booking.securityNote }}</span>
    </div>

    <div class="divider" />

    <!-- 耳麦 -->
    <h3 class="card-title mb14">讲解耳麦发放</h3>
    <div v-if="!booking.needHeadsets" class="alert alert-info mb14">该团体预约时选择不借用耳麦。</div>
    <template v-else>
      <div v-if="!booking.headsets.length" class="flex mb14 wrap">
        <span>发放数量</span>
        <input v-model.number="hsCount" type="number" min="1" :max="store.headsetAvailable" class="input" style="width: 110px" />
        <span class="small muted">押金 ¥{{ booking.depositPer }}/台，合计 ¥{{ (hsCount * booking.depositPer).toLocaleString() }} · 库存可借 {{ store.headsetAvailable }}</span>
        <button class="btn btn-jade" @click="doIssue">发放耳麦并收押金</button>
      </div>
      <div v-else class="alert alert-ok mb14">
        ✓ 已发 {{ booking.headsets.length }} 台 · 押金 ¥{{ booking.depositTotal?.toLocaleString() }} 已预收（设备编号 {{ booking.headsets[0].code }} 起）
      </div>
    </template>

    <div class="divider" />

    <!-- 批次 -->
    <h3 class="card-title mb14">入馆批次与安检通道</h3>
    <div class="inline-fields">
      <div class="field">
        <label>批次时间（受前序延误时顺延）</label>
        <select v-model.number="batchAt" class="select">
          <option v-for="s in slotList" :key="s" :value="s">{{ m2hm(s) }}</option>
        </select>
      </div>
      <div class="field">
        <label>安检通道（实时负载）</label>
        <select v-model="lane" class="select">
          <option v-for="l in LANES" :key="l" :value="l">{{ l }} · 当前约 {{ laneLoad(l) }} 人</option>
        </select>
      </div>
    </div>
    <div v-if="booking.size >= 40" class="alert alert-warn mb14">
      大团 {{ booking.size }} 人：确认时已拆 {{ Math.ceil(booking.size / 30) }} 批，每批 ≤30 人、间隔 {{ ENTRY_SLOT }} 分钟，讲解员随首批入场。
    </div>
    <div class="flex">
      <button class="btn" @click="doBatch">更新批次安排</button>
      <button class="btn btn-jade" :disabled="!booking.actualArrive" @click="doAdmit">安排入馆，开始讲解</button>
    </div>
  </section>
</template>
