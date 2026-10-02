<script setup lang="ts">
import { computed } from 'vue'
import type { Booking, HeadsetUnit } from '@/types'
import { money } from '@/utils/time'
import { useToast } from '@/composables/useToast'
import { useMuseumStore } from '@/stores/museum'

const props = defineProps<{ booking: Booking }>()
const store = useMuseumStore()
const { toast } = useToast()

const st = computed(() => store.settlement(props.booking))

function ret(u: HeadsetUnit) {
  store.markHeadset(props.booking.id, u.code, '已还', '复检正常')
  toast(`耳麦 ${u.code} 已归还`)
}
function retAll() {
  const n = props.booking.headsets.filter((u) => u.state === '已发').length
  store.returnAllHeadsets(props.booking.id)
  toast(`已批量归还 ${n} 台（损坏/遗失设备保留定责）`)
}
function relabel(u: HeadsetUnit, state: '损坏' | '遗失') {
  const issue = state === '损坏'
    ? prompt('损坏情况', u.issue ?? '耳罩脱落 / 无声')
    : prompt('遗失经过', u.issue ?? '清点未找到')
  if (issue === null) return
  store.markHeadset(props.booking.id, u.code, state, issue || (state === '损坏' ? '设备损坏' : '设备遗失'))
}
</script>

<template>
  <section class="card card-pad">
    <h2 class="card-title mb14">耳麦借还与押金</h2>

    <div class="grid cols-4 mb14">
      <div class="stat card" style="box-shadow: none">
        <div class="stat-label">发出</div>
        <div class="stat-value">{{ st.issued }}<span class="stat-unit">台</span></div>
      </div>
      <div class="stat card" style="box-shadow: none">
        <div class="stat-label">损坏 / 遗失</div>
        <div class="stat-value" :style="st.damaged + st.lost ? 'color:var(--bad-fg)' : ''">
          {{ st.damaged }}/{{ st.lost }}
        </div>
      </div>
      <div class="stat card" style="box-shadow: none">
        <div class="stat-label">在押金额</div>
        <div class="stat-value" style="font-size: 22px">{{ money(booking.depositTotal ?? 0) }}</div>
      </div>
      <div class="stat card" style="box-shadow: none">
        <div class="stat-label">预计应退</div>
        <div class="stat-value" style="font-size: 22px; color: var(--jade)">{{ money(Math.max(0, st.refund)) }}</div>
        <div v-if="st.damageFee + st.lostFee" class="stat-trend" style="color: var(--bad-fg)">
          扣维修 ¥{{ st.damageFee }} · 赔偿 ¥{{ st.lostFee }}
        </div>
      </div>
    </div>

    <div v-if="!booking.headsets.length" class="empty">未借用耳麦</div>
    <template v-else>
      <div v-if="booking.status !== '已离馆' && st.outstanding > 0" class="flex mb14">
        <button class="btn btn-jade btn-sm" @click="retAll">批量标记剩余 {{ st.outstanding }} 台复检正常</button>
        <span class="small muted">或在下方逐台登记损坏 / 遗失</span>
      </div>
      <div class="scroll-x">
      <table class="table">
      <thead>
        <tr>
          <th>设备编号</th>
          <th>状态</th>
          <th>问题记录</th>
          <th>离馆复检操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in booking.headsets" :key="u.code">
          <td>{{ u.code }}</td>
          <td>
            <span class="badge" :class="u.state === '已发' ? 'badge-warn' : u.state === '已还' ? 'badge-ok' : 'badge-bad'">{{ u.state }}</span>
          </td>
          <td class="small muted">{{ u.issue ?? '—' }}</td>
          <td>
            <div v-if="booking.status !== '已离馆'" class="flex">
              <button v-if="u.state !== '已还'" class="btn btn-sm btn-jade" @click="ret(u)">归还正常</button>
              <button class="btn btn-sm danger-text" @click="relabel(u, '损坏')">损坏</button>
              <button class="btn btn-sm danger-text" @click="relabel(u, '遗失')">遗失</button>
            </div>
            <span v-else class="small muted">已结算</span>
          </td>
        </tr>
      </tbody>
    </table>
      </div>
    </template>
    <div v-if="st.outstanding > 0 && booking.status !== '已离馆'" class="alert alert-warn mt14">
      仍有 {{ st.outstanding }} 台耳麦状态为“已发”，离馆结算前需逐台核对（归还 / 损坏 / 遗失）。
    </div>
  </section>
</template>
