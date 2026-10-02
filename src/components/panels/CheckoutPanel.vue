<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import type { Booking } from '@/types'
import type { Complaint } from '@/types'
import { m2hm, dur, money } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()
const { toast } = useToast()

const sat = ref(props.booking.satisfaction ?? 5)
const st = computed(() => store.settlement(props.booking))

const actualDur = computed(() =>
  props.booking.route
    .filter((s) => s.state === '已完成')
    .reduce((n, s) => n + ((s.actualLeave ?? store.now) - (s.actualEnter ?? store.now)), 0)
)
const skipped = computed(() => props.booking.route.filter((s) => s.state === '已跳过').length)
const waitMin = computed(() =>
  props.booking.enteredAt && props.booking.actualArrive ? props.booking.enteredAt - props.booking.actualArrive : 0
)

function doCheckout() {
  if (st.value.outstanding > 0) {
    toast(`还有 ${st.value.outstanding} 台耳麦未核对`)
    return
  }
  store.checkout(props.booking.id, sat.value)
  toast('离馆结算完成，押金与满意度已记录')
}

// 投诉
const compOpen = ref(false)
const compType = ref<Complaint['type']>('讲解缩水')
const compDetail = ref('')
const handleNote = ref('')
function addComplaint() {
  if (!compDetail.value.trim()) {
    toast('请填写投诉内容')
    return
  }
  store.addComplaint(props.booking.id, compType.value, compDetail.value.trim())
  compOpen.value = false
  compDetail.value = ''
  toast('投诉已登记，可在时间线与复盘页溯源')
}
function resolve() {
  if (!handleNote.value.trim()) {
    toast('请填写处理结果')
    return
  }
  store.resolveComplaint(props.booking.id, handleNote.value.trim())
  toast('投诉已处理归档')
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="card-title mb14">离馆核对 · 押金结算 · 满意度</h2>

    <div class="grid cols-2 mb14">
      <div class="kv">
        <dt>计划讲解</dt><dd>{{ dur(booking.plannedDuration ?? 0) }}</dd>
        <dt>实际讲解</dt>
        <dd :style="actualDur < (booking.plannedDuration ?? 0) - 10 ? 'color:var(--bad-fg);font-weight:600' : ''">
          {{ dur(actualDur) }}
          <span v-if="actualDur < (booking.plannedDuration ?? 0) - 10">
            （缩水 {{ (booking.plannedDuration ?? 0) - actualDur }} 分钟）
          </span>
        </dd>
        <dt>跳过展厅</dt><dd :style="skipped ? 'color:var(--warn-fg)' : ''">{{ skipped }} 个</dd>
        <dt>候场等待</dt>
        <dd :style="waitMin >= 15 ? 'color:var(--bad-fg);font-weight:600' : ''">{{ waitMin }} 分钟（核验→入场）</dd>
        <dt>设备押金</dt><dd>{{ money(booking.depositTotal ?? 0) }} · 扣维修 {{ money(st.damageFee) }} · 扣赔偿 {{ money(st.lostFee) }}</dd>
        <dt>实际退还</dt><dd><b style="color: var(--jade)">{{ money(Math.max(0, st.refund)) }}</b></dd>
      </div>
      <div>
        <div v-if="booking.status !== '已离馆'" class="field">
          <label>满意度评分</label>
          <div class="flex" style="gap: 6px">
            <button
              v-for="n in [1, 2, 3, 4, 5]"
              :key="n"
              class="btn btn-sm"
              :class="n <= sat ? 'btn-primary' : ''"
              @click="sat = n"
              style="font-size: 16px"
            >★</button>
            <span class="small muted">{{ ['', '很不满意', '不满意', '一般', '满意', '非常满意'][sat] }}</span>
          </div>
        </div>
        <div v-if="booking.status !== '已离馆'" class="alert" :class="st.outstanding ? 'alert-warn' : 'alert-ok'">
          {{ st.outstanding ? `还有 ${st.outstanding} 台耳麦未归还/定责，请先在设备面板核对。` : '设备已全部核对，可以离馆结算。' }}
        </div>
      </div>
    </div>

    <div v-if="booking.status !== '已离馆'" class="flex mb14">
      <button class="btn btn-jade" :disabled="st.outstanding > 0" @click="doCheckout">确认离馆并结算押金</button>
      <button v-if="!booking.complaint" class="btn danger-text" @click="compOpen = true">登记团体投诉</button>
    </div>
    <div v-else class="alert alert-info mb14">
      已于 {{ m2hm(booking.actualLeave ?? 0) }} 离馆结算，满意度 {{ booking.satisfaction }}/5。
    </div>

    <!-- 投诉 -->
    <div v-if="booking.complaint" class="card" style="padding: 13px 15px; box-shadow: none; border-color: #e3c3ba">
      <div class="flex-between mb14">
        <b style="color: var(--bad-fg)">投诉：{{ booking.complaint.type }}</b>
        <span class="badge" :class="booking.complaint.resolved ? 'badge-ok' : 'badge-bad'">
          {{ booking.complaint.resolved ? '已处理' : '待处理' }}
        </span>
      </div>
      <div class="small">{{ booking.complaint.detail }}</div>
      <div class="small muted" style="margin: 4px 0 10px">登记时间 {{ m2hm(booking.complaint.at) }} · 可结合右侧时间线查看：到馆时间、分流决策、讲解员变更、展厅容量快照与设备借还记录</div>
      <div v-if="!booking.complaint.resolved && booking.status === '已离馆'" class="flex">
        <input v-model="handleNote" class="input grow" placeholder="处理结果（致歉 / 补偿 / 规则与排班改进）" />
        <button class="btn btn-primary" @click="resolve">处理归档</button>
      </div>
      <div v-if="booking.complaint.resolved" class="alert alert-ok" style="margin-top: 8px">处理结果：{{ booking.complaint.handleNote }}</div>
    </div>

    <div v-if="compOpen" class="modal-mask" @click.self="compOpen = false">
      <div class="modal card">
        <h3 class="card-title mb14">登记投诉</h3>
        <div class="field">
          <label>投诉类型</label>
          <select v-model="compType" class="select">
            <option>讲解缩水</option>
            <option>等待过长</option>
            <option>服务态度</option>
            <option>其他</option>
          </select>
        </div>
        <div class="field">
          <label>具体情况</label>
          <textarea v-model="compDetail" class="textarea" placeholder="如：实际讲解仅 30 分钟、少看一个展厅，安检等待 25 分钟"></textarea>
        </div>
        <div class="flex">
          <button class="btn btn-primary" @click="addComplaint">提交投诉</button>
          <button class="btn" @click="compOpen = false">取消</button>
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
  width: min(520px, 100%);
  padding: 20px 22px;
}
</style>
