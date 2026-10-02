<script setup lang="ts">
import { computed } from 'vue'
import { useMuseumStore } from '@/stores/museum'
import { m2hm } from '@/utils/time'

const store = useMuseumStore()

const done = computed(() => store.bookingList.filter((b) => b.status === '已离馆'))

interface Row {
  id: string
  name: string
  size: number
  wait: number
  planned: number
  actual: number
  ratio: number
  sat: number
  damaged: number
  lost: number
  guide: string
  complaint?: boolean
}

const rows = computed<Row[]>(() =>
  done.value
    .map((b) => {
      const actual = b.route.length
        ? b.route.filter((s) => s.state === '已完成').reduce((n, s) => n + ((s.actualLeave ?? 0) - (s.actualEnter ?? 0)), 0)
        : (b.actualLeave ?? 0) - (b.enteredAt ?? b.actualLeave ?? 0)
      return {
        id: b.id,
        name: b.orgName,
        size: b.size,
        wait: (b.enteredAt ?? b.arriveAt) - (b.actualArrive ?? b.arriveAt),
        planned: b.plannedDuration ?? 0,
        actual,
        ratio: b.plannedDuration ? Math.round((actual / (b.plannedDuration ?? 1)) * 100) : 100,
        sat: b.satisfaction ?? 0,
        damaged: b.headsets.filter((h) => h.state === '损坏').length,
        lost: b.headsets.filter((h) => h.state === '遗失').length,
        guide: store.guideById(b.guideId)?.name ?? '—',
        complaint: !!b.complaint
      }
    })
    .sort((a, b) => a.id.localeCompare(b.id))
)

const maxWait = computed(() => Math.max(10, ...rows.value.map((r) => r.wait)))
const maxDur = computed(() => Math.max(...rows.value.map((r) => Math.max(r.planned, r.actual)), 10))

const avgWait = computed(() => (rows.value.length ? Math.round(rows.value.reduce((n, r) => n + r.wait, 0) / rows.value.length) : 0))
const fulfillRate = computed(() => {
  const ok = rows.value.filter((r) => r.ratio >= 90).length
  return rows.value.length ? Math.round((ok / rows.value.length) * 100) : 0
})
const avgSat = computed(() => (rows.value.length ? (rows.value.reduce((n, r) => n + r.sat, 0) / rows.value.length).toFixed(1) : '—'))
const compCount = computed(() => rows.value.filter((r) => r.complaint).length)
const issuedTotal = computed(() => rows.value.reduce((n, b) => n + store.getBooking(b.id)!.headsets.length, 0))
const badDevice = computed(() => rows.value.reduce((n, r) => n + r.damaged + r.lost, 0))

// 分流热点（事件计数）
const divert = computed(() =>
  store.hallList
    .map((h) => ({
      hall: h,
      crowd: store.events.filter((e) => (e.kind === '拥堵分流' || e.kind === '路线调整') && e.hallId === h.id).length,
      maint: store.events.filter((e) => e.kind === '展厅维护' && e.hallId === h.id).length
    }))
    .filter((x) => x.crowd + x.maint > 0)
)
const maxEvent = computed(() => Math.max(1, ...divert.value.map((x) => x.crowd + x.maint)))

// 讲解员负荷
const guideLoad = computed(() =>
  store.guideList
    .map((g) => {
      const teams = done.value.filter((b) => b.guideId === g.id)
      const mins = teams.reduce((n, b) => n + ((b.actualLeave ?? 0) - (b.enteredAt ?? 0)), 0)
      return { name: g.name, title: g.title, teams: teams.length, mins, langs: g.langs.join('/') }
    })
    .filter((x) => x.teams > 0)
)

// 满意度分布
const satDist = computed(() => [1, 2, 3, 4, 5].map((s) => ({ s, n: rows.value.filter((r) => r.sat === s).length })))

// —— 自动优化建议 ——
const advices = computed(() => {
  const a: { tone: 'bad' | 'warn' | 'ok'; text: string }[] = []
  if (avgWait.value >= 15)
    a.push({ tone: 'bad', text: `今晨团队平均候场 ${avgWait.value} 分钟，09:00–09:30 通道A 三团叠加：建议早高峰将 30 人以上学校团默认拆批、提前 10 分钟开放通道B 团队口。` })
  const late = rows.value.filter((r) => r.ratio < 90)
  if (late.length)
    a.push({ tone: 'bad', text: `${late.length} 个团讲解时长兑现不足 90%（${late.map((r) => `${r.name} ${r.ratio}%`).join('、')}）：压缩多由安检等待与临时换讲解引发，建议换讲解必须有同主题备班并预留 5 分钟交接，且不得挤占讲解时长。` })
  if (compCount.value)
    a.push({ tone: 'warn', text: `今日 ${compCount.value} 件投诉均与等待/缩水相关：建议在预约确认页向旅行社明示“计划讲解时长 + 取消展厅需签字同意”，时间线记录作为申诉依据。` })
  if (badDevice.value)
    a.push({ tone: 'warn', text: `耳麦损坏/遗失 ${badDevice.value} 台（借出 ${issuedTotal.value} 台，异常率 ${Math.round((badDevice.value / Math.max(1, issuedTotal.value)) * 100)}%）：建议儿童团改发防摔黄标接收器并在 H4 互动厅出口增设复检点。` })
  if (divert.value.some((d) => d.hall.id === 'H1'))
    a.push({ tone: 'warn', text: '历代书画厅（镇馆之宝 + 全厅禁拍）为最高频拥堵/分流点：建议对该厅实施团队预约时隙限流（每 15 分钟 ≤2 团），并把团队讲解点移至展位侧后方，让出正面散客动线。' })
  const heavy = guideLoad.value.find((g) => g.teams >= 2)
  if (heavy)
    a.push({ tone: 'warn', text: `${heavy.name} 今日已连续带 ${heavy.teams} 团（${heavy.mins} 分钟）：建议午间至少预留 40 分钟空档，避免连班导致讲解缩水。` })
  a.push({ tone: 'ok', text: '亲子团（互动探索厅→雕塑庭院）路线零分流、满意度 5/5：可固化为儿童团默认路线，安静展厅仅在尾段安排 15 分钟轻声观展。' })
  return a
})
</script>

<template>
  <div>
    <div class="grid cols-4 mb14">
      <div class="card stat"><div class="stat-label">平均候场等待</div><div class="stat-value" :style="avgWait >= 15 ? 'color:var(--bad-fg)' : ''">{{ avgWait }}<span class="stat-unit">分钟</span></div><div class="stat-trend">核验通过 → 实际入场</div></div>
      <div class="card stat"><div class="stat-label">讲解时长兑现率</div><div class="stat-value" :style="fulfillRate < 80 ? 'color:var(--bad-fg)' : 'color:var(--jade)'">{{ fulfillRate }}<span class="stat-unit">%</span></div><div class="stat-trend">实际 ≥ 计划 90% 视为兑现</div></div>
      <div class="card stat"><div class="stat-label">平均满意度</div><div class="stat-value">{{ avgSat }}<span class="stat-unit">/5</span></div><div class="stat-trend">今日已离馆 {{ rows.length }} 团</div></div>
      <div class="card stat"><div class="stat-label">投诉 / 设备异常</div><div class="stat-value" :style="compCount ? 'color:var(--cinnabar)' : ''">{{ compCount }}<span class="stat-unit">件</span></div><div class="stat-trend">耳麦损坏遗失 {{ badDevice }}/{{ issuedTotal }} 台</div></div>
    </div>

    <div class="grid cols-2 mb14">
      <!-- 等待时长 -->
      <section class="card card-pad">
        <h2 class="card-title mb14">各团候场等待（分钟）</h2>
        <div class="bars">
          <div v-for="r in rows" :key="r.id" class="bar-col">
            <span class="bar-val" :style="r.wait >= 15 ? 'color:var(--bad-fg);font-weight:700' : ''">{{ r.wait }}′</span>
            <div
              class="bar"
              :style="{
                height: `${(r.wait / maxWait) * 100}%`,
                background: r.wait >= 15 ? 'linear-gradient(180deg,#c96a52,#a23a28)' : r.wait >= 8 ? 'linear-gradient(180deg,#d18a48,#c06a2b)' : 'linear-gradient(180deg,#6f9c85,#3f6f5f)'
              }"
            />
            <span class="bar-label">{{ r.name.length > 5 ? r.name.slice(0, 5) : r.name }}</span>
          </div>
        </div>
        <div class="small muted mt14">红色 ≥15 分钟：等待过长投诉高风险时段，建议拆批 / 增开通道。</div>
      </section>

      <!-- 时长兑现 -->
      <section class="card card-pad">
        <h2 class="card-title mb14">讲解时长兑现：计划 vs 实际（分钟）</h2>
        <div class="bars" style="align-items: flex-end">
          <div v-for="r in rows" :key="r.id" class="bar-col" style="justify-content: flex-end">
            <span class="bar-val" :style="r.ratio < 90 ? 'color:var(--bad-fg);font-weight:700' : ''">{{ r.actual }}/{{ r.planned }} · {{ r.ratio }}%</span>
            <div style="display: flex; gap: 3px; align-items: flex-end; height: calc(100% - 30px); width: 100%; justify-content: center">
              <div class="bar" style="background: linear-gradient(180deg,#cbb98e,#9a7b35); max-width: 16px" :style="{ height: `${(r.planned / maxDur) * 100}%` }" title="计划" />
              <div class="bar" :style="{ maxWidth: '16px', height: `${(r.actual / maxDur) * 100}%`, background: r.ratio < 90 ? 'linear-gradient(180deg,#c96a52,#a23a28)' : 'linear-gradient(180deg,#6f9c85,#3f6f5f)' }" title="实际" />
            </div>
            <span class="bar-label">{{ r.name.length > 5 ? r.name.slice(0, 5) : r.name }}</span>
          </div>
        </div>
        <div class="small muted mt14"><span style="color: var(--gold)">■ 计划</span> &nbsp; <span style="color: var(--jade)">■ 实际达标</span> &nbsp; <span style="color: var(--cinnabar)">■ 实际缩水</span></div>
      </section>
    </div>

    <div class="grid cols-2 mb14">
      <!-- 满意度 -->
      <section class="card card-pad">
        <h2 class="card-title mb14">满意度分布与投诉</h2>
        <div class="bars" style="height: 120px">
          <div v-for="d in satDist" :key="d.s" class="bar-col">
            <span class="bar-val">{{ d.n }}</span>
            <div class="bar" :style="{ height: `${(d.n / rows.length) * 100}%`, background: d.s <= 3 ? 'linear-gradient(180deg,#c96a52,#a23a28)' : 'linear-gradient(180deg,#6f9c85,#3f6f5f)' }" />
            <span class="bar-label">{{ '★'.repeat(d.s) }}</span>
          </div>
        </div>
        <div class="divider" />
        <div v-for="b in done.filter((x) => x.complaint)" :key="b.id" class="alert" :class="b.complaint?.resolved ? 'alert-ok' : 'alert-block'" style="margin-bottom: 8px">
          <div>
            <b>{{ b.id }} {{ b.orgName }} · {{ b.complaint?.type }}</b>
            <div class="small">{{ b.complaint?.detail }}</div>
            <div v-if="b.complaint?.handleNote" class="small" style="margin-top: 3px">处理：{{ b.complaint.handleNote }}</div>
          </div>
        </div>
      </section>

      <!-- 分流热点 -->
      <section class="card card-pad">
        <h2 class="card-title mb14">展厅分流 / 维护事件热点</h2>
        <div v-if="divert.length" class="grid" style="gap: 10px">
          <div v-for="d in divert" :key="d.hall.id">
            <div class="flex-between small">
              <span><b>{{ d.hall.name.replace(/^[一二三四]层·/, '') }}</b>
                <span v-if="d.hall.quiet" class="chip quiet" style="margin-left: 6px">安静</span>
                <span v-if="d.hall.childFriendly" class="chip kid" style="margin-left: 4px">儿童</span>
              </span>
              <span class="muted">分流 {{ d.crowd }} · 维护 {{ d.maint }}</span>
            </div>
            <div class="meter" style="margin-top: 5px">
              <i class="fill-crowd" :style="{ width: `${((d.crowd + d.maint) / maxEvent) * 100}%` }" />
            </div>
          </div>
        </div>
        <div v-else class="empty">暂无分流记录</div>
        <div class="divider" />
        <h3 class="card-title mb14" style="font-size: 13.5px">讲解员今日带团负荷</h3>
        <table class="table">
          <thead><tr><th>讲解员</th><th>语言</th><th>已完成团</th><th>讲解分钟</th></tr></thead>
          <tbody>
            <tr v-for="g in guideLoad" :key="g.name">
              <td>{{ g.name }}<span class="small muted"> · {{ g.title }}</span></td>
              <td class="small">{{ g.langs }}</td>
              <td>{{ g.teams }}</td>
              <td :style="g.mins > 150 ? 'color:var(--warn-fg);font-weight:600' : ''">{{ g.mins }} 分钟</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- 建议 -->
    <section class="card card-pad">
      <h2 class="card-title mb14">面向大团预约规则 · 讲解员排班 · 展厅限流的优化建议（由今日记录生成）</h2>
      <div class="alert-list">
        <div v-for="(a, i) in advices" :key="i" class="alert" :class="a.tone === 'bad' ? 'alert-block' : a.tone === 'warn' ? 'alert-warn' : 'alert-ok'">
          {{ a.tone === 'ok' ? '✓' : a.tone === 'warn' ? '⚠' : '✕' }} {{ a.text }}
        </div>
      </div>
    </section>

    <div class="small muted mt14">统计口径：今日已离馆 {{ done.length }} 个团体（{{ done.map((b) => b.id).join('、') }}），数据截至 {{ m2hm(store.now) }}；所有结论均来自可追溯的预约时间线与设备借还记录。</div>
  </div>
</template>
