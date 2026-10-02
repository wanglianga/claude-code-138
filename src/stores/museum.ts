import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Booking,
  BookingDraft,
  Closure,
  Complaint,
  EventKind,
  EventTag,
  Exhibit,
  Guide,
  Hall,
  HeadsetUnit,
  Lane,
  RouteStop,
  ThemeId,
  TimelineEvent
} from '@/types'
import {
  bookings as seedBookings,
  closures as seedClosures,
  dockSpots,
  exhibits,
  guides,
  halls,
  timeline as seedTimeline
} from '@/data/seed'
import {
  BATCH_LIMIT,
  BIG_GROUP,
  CROWD_RATIO,
  DEPOSIT_PER,
  ENTRY_SLOT,
  HEADSET_STOCK,
  NOW_MIN,
  QUIET_CROWD_RATIO
} from '@/config'
import { m2hm, uid } from '@/utils/time'

export type IssueLevel = 'block' | 'warn' | 'ok'
export interface PlanIssue {
  level: IssueLevel
  text: string
}
export interface ConfirmPlan {
  guideId: string
  batchStart: number
  lane: Lane
  route: RouteStop[]
  plannedDuration: number
}

const THEME_ROUTE: Record<ThemeId, { hallId: string; dur: number }[]> = {
  亲子探秘: [
    { hallId: 'H4', dur: 30 },
    { hallId: 'H2', dur: 25 },
    { hallId: 'H1', dur: 15 }
  ],
  常设精选: [
    { hallId: 'H1', dur: 20 },
    { hallId: 'H2', dur: 18 },
    { hallId: 'H3', dur: 22 }
  ],
  特展专题: [
    { hallId: 'H5', dur: 25 },
    { hallId: 'H1', dur: 18 },
    { hallId: 'H3', dur: 17 }
  ],
  建筑艺术: [
    { hallId: 'H2', dur: 20 },
    { hallId: 'H3', dur: 18 },
    { hallId: 'H6', dur: 18 }
  ],
  快速通览: [
    { hallId: 'H2', dur: 15 },
    { hallId: 'H1', dur: 15 },
    { hallId: 'H3', dur: 15 }
  ]
}

const LANE_BASE: Record<Lane, number> = {
  团队通道A: 31,
  团队通道B: 14,
  无障碍优先通道: 6
}
const LANE_CAP: Record<Lane, number> = {
  团队通道A: 40,
  团队通道B: 40,
  无障碍优先通道: 20
}

const ACTIVE: Booking['status'][] = ['已确认', '已到馆', '讲解中']

export const useMuseumStore = defineStore('museum', () => {
  const hallList = ref<Hall[]>(structuredClone(halls))
  const exhibitList = ref<Exhibit[]>([...exhibits])
  const guideList = ref<Guide[]>([...guides])
  const closureList = ref<Closure[]>([...seedClosures])
  const bookingList = ref<Booking[]>(structuredClone(seedBookings))
  const events = ref<TimelineEvent[]>([...seedTimeline])
  const now = ref(NOW_MIN)
  const spots = [...dockSpots]

  // —— 基础查询 ——
  const hallById = (id: string) => hallList.value.find((h) => h.id === id)
  const guideById = (id?: string) => guideList.value.find((g) => g.id === id)
  const exhibitsOf = (hallId: string) => exhibitList.value.filter((e) => e.hallId === hallId)
  const getBooking = (id: string) => bookingList.value.find((b) => b.id === id)
  const eventsOf = (id: string) =>
    [...events.value].filter((e) => e.bookingId === id).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))

  function closureActive(hallId: string, at: number = now.value): Closure | undefined {
    return closureList.value.find((c) => c.hallId === hallId && at >= c.start && at < c.end)
  }
  function closureOverlap(hallId: string, start: number, end: number): Closure | undefined {
    return closureList.value.find((c) => c.hallId === hallId && start < c.end && end > c.start)
  }

  // —— 实时客流 ——
  /** 散客客流分时段系数（开馆高峰 → 午后回落） */
  function baseFactor(at: number): number {
    if (at < 11 * 60) return 1
    if (at < 13 * 60) return 0.72
    if (at < 15 * 60) return 0.55
    return 0.42
  }
  /** 未来时段的预计散客基数 */
  function projectedBase(hallId: string, at: number): number {
    return Math.round((hallById(hallId)?.baseOccupancy ?? 0) * baseFactor(at))
  }
  /** 厅内散客 + 正在参观的团体人数 */
  function liveOccupancy(hallId: string, at: number = now.value): number {
    const hall = hallById(hallId)
    let n = Math.round((hall?.baseOccupancy ?? 0) * baseFactor(at))
    for (const b of bookingList.value) {
      if (b.status !== '讲解中') continue
      for (const s of b.route) {
        if (s.hallId !== hallId || s.state !== '参观中') continue
        if (s.actualEnter !== undefined && at >= s.actualEnter) n += b.actualSize?.total ?? b.size
      }
    }
    return n
  }

  type CrowdLabel = '拥堵' | '较挤' | '正常' | '宽松' | '关闭'
  function crowdOf(hallId: string, at: number = now.value): { label: CrowdLabel; ratio: number; occ: number } {
    const hall = hallById(hallId)
    if (!hall) return { label: '关闭', ratio: 0, occ: 0 }
    if (hall.status !== '开放' || closureActive(hallId, at)) return { label: '关闭', ratio: 0, occ: 0 }
    const occ = liveOccupancy(hallId, at)
    const ratio = occ / hall.capacity
    const threshold = hall.quiet ? QUIET_CROWD_RATIO : CROWD_RATIO
    let label: CrowdLabel = '宽松'
    if (ratio >= threshold) label = '拥堵'
    else if (ratio >= 0.6) label = '较挤'
    else if (ratio >= 0.35) label = '正常'
    return { label, ratio, occ }
  }

  /** 开放、可达且不拥堵的备选厅（路线调整时选） */
  function alternativeHalls(b: Booking, excludeId?: string) {
    return hallList.value.filter((h) => {
      if (h.id === excludeId) return false
      if (h.status !== '开放' || closureActive(h.id)) return false
      if (b.accessible && !h.accessible) return false
      return crowdOf(h.id).label !== '拥堵'
    })
  }

  // —— 耳麦库存与押金 ——
  const issuedHeadsets = computed(() =>
    bookingList.value
      .filter((b) => b.status === '讲解中' || b.status === '已到馆')
      .reduce((n, b) => n + b.headsets.filter((h) => h.state === '已发').length, 0)
  )
  const headsetAvailable = computed(() => HEADSET_STOCK - issuedHeadsets.value)
  const depositHeld = computed(() =>
    bookingList.value
      .filter((b) => b.status === '讲解中' || b.status === '已到馆')
      .reduce((n, b) => n + (b.depositTotal ?? 0), 0)
  )

  function settlement(b: Booking) {
    const issued = b.headsets.length
    const damaged = b.headsets.filter((h) => h.state === '损坏').length
    const lost = b.headsets.filter((h) => h.state === '遗失').length
    const returned = b.headsets.filter((h) => h.state === '已还').length
    const damageFee = damaged * 50
    const lostFee = lost * 300
    const refund = (b.depositTotal ?? 0) - damageFee - lostFee
    return { issued, damaged, lost, returned, outstanding: issued - returned - damaged - lost, damageFee, lostFee, refund }
  }

  // —— 排班 ——
  function guideBusyWindows(g: Guide) {
    return bookingList.value
      .filter((b) => b.guideId === g.id && ACTIVE.includes(b.status))
      .map((b) => ({
        booking: b,
        start: b.batchStart ?? b.arriveAt + 10,
        end: (b.batchStart ?? b.arriveAt + 10) + (b.plannedDuration ?? 60)
      }))
  }
  function guideAvailable(g: Guide, start: number, end: number, b: Booking): string | null {
    if (!g.langs.includes(b.lang)) return `语言不匹配（需 ${b.lang}）`
    if (!g.themes.includes(b.theme)) return `不熟悉「${b.theme}」主题`
    if (start < g.dutyStart) return `早于排班开始 ${m2hm(g.dutyStart)}`
    if (end > g.dutyEnd) return `超出排班结束 ${m2hm(g.dutyEnd)}`
    const clash = guideBusyWindows(g).find((w) => start < w.end && end > w.start && w.booking.id !== b.id)
    if (clash) return `与 ${clash.booking.id} ${m2hm(clash.start)}–${m2hm(clash.end)} 时段冲突`
    return null
  }

  // —— 路线生成 ——
  function buildRoute(b: Booking, start: number): RouteStop[] {
    const stops: RouteStop[] = []
    let cursor = start
    for (const item of THEME_ROUTE[b.theme]) {
      const hall = hallById(item.hallId)
      if (!hall) continue
      if (hall.status !== '开放') continue
      if (b.accessible && !hall.accessible) continue
      if (closureOverlap(item.hallId, cursor, cursor + item.dur)) continue
      stops.push({ hallId: item.hallId, plannedEnter: cursor, plannedDuration: item.dur, state: '计划' })
      cursor += item.dur + 3
    }
    return stops
  }

  const routeDuration = (route: RouteStop[]) =>
    route.reduce((n, s) => n + s.plannedDuration, 0) + Math.max(0, route.length - 1) * 3

  function suggestPlan(b: Booking): ConfirmPlan {
    const start = Math.ceil((b.arriveAt + 10) / ENTRY_SLOT) * ENTRY_SLOT
    const route = buildRoute(b, start)
    const plannedDuration = routeDuration(route)
    const lane: Lane = b.accessible ? '无障碍优先通道' : '团队通道A'
    const guide =
      guideList.value.find((g) => guideAvailable(g, start, start + plannedDuration, b) === null) ?? guideList.value[0]
    return { guideId: guide.id, batchStart: start, lane, route, plannedDuration }
  }

  // —— 确认前冲突检测 ——
  function evaluate(b: Booking, plan: ConfirmPlan): PlanIssue[] {
    const issues: PlanIssue[] = []
    const hall = (id: string) => hallById(id)!

    // 讲解员
    const guide = guideById(plan.guideId)
    if (guide) {
      const reason = guideAvailable(guide, plan.batchStart, plan.batchStart + plan.plannedDuration, b)
      if (reason) issues.push({ level: 'block', text: `讲解员 ${guide.name}：${reason}` })
      else issues.push({ level: 'ok', text: `讲解员 ${guide.name} 当班，语言/主题/时段均匹配` })
    }

    // 无障碍
    const badAccess = plan.route.filter((s) => b.accessible && !hall(s.hallId).accessible)
    if (b.accessible && badAccess.length) issues.push({ level: 'block', text: '无障碍路线包含不可达展厅（无电梯/坡道）' })
    if (b.accessible && !badAccess.length) issues.push({ level: 'ok', text: '全程无障碍：坡道/电梯可达，不含阁楼展区' })

    // 每个展厅：闭展 / 容量
    for (const s of plan.route) {
      const h = hall(s.hallId)
      const end = s.plannedEnter + s.plannedDuration
      const closure = closureOverlap(s.hallId, s.plannedEnter, end)
      if (h.status !== '开放' || closure) {
        issues.push({
          level: 'block',
          text: `${h.name} ${m2hm(s.plannedEnter)}–${m2hm(end)} 处于${closure ? closure.reason : h.status}时段`
        })
        continue
      }
      let occ = projectedBase(s.hallId, s.plannedEnter)
      for (const other of bookingList.value) {
        if (other.id === b.id || !ACTIVE.includes(other.status)) continue
        for (const os of other.route) {
          if (os.hallId !== s.hallId) continue
          const oStart = os.actualEnter ?? os.plannedEnter
          const oEnd = os.actualLeave ?? oStart + os.plannedDuration
          if (s.plannedEnter < oEnd && end > oStart) occ += other.actualSize?.total ?? other.size
        }
      }
      const ratio = occ / h.capacity
      const threshold = h.quiet ? QUIET_CROWD_RATIO : CROWD_RATIO
      const snap = `${occ}/${h.capacity}`
      if (ratio >= threshold)
        issues.push({ level: 'warn', text: `${h.name} ${m2hm(s.plannedEnter)} 预计 ${snap}，达拥堵阈值，建议错峰或改道` })
      else issues.push({ level: 'ok', text: `${h.name} ${m2hm(s.plannedEnter)} 预计 ${snap}，容量可承接` })
    }

    // 安检通道
    const laneLoad =
      LANE_BASE[plan.lane] +
      bookingList.value
        .filter((o) => o.id !== b.id && ACTIVE.includes(o.status) && o.lane === plan.lane && o.batchStart === plan.batchStart)
        .reduce((n, o) => n + o.size, 0)
    if (plan.lane !== '无障碍优先通道' && b.accessible)
      issues.push({ level: 'warn', text: '含轮椅/拐杖访客，建议走无障碍优先通道' })
    if (laneLoad > LANE_CAP[plan.lane])
      issues.push({ level: 'warn', text: `${plan.lane} ${m2hm(plan.batchStart)} 排队 ${laneLoad} 人，建议改通道或顺延 15 分钟` })
    else issues.push({ level: 'ok', text: `${plan.lane} ${m2hm(plan.batchStart)} 排队约 ${laneLoad}/${LANE_CAP[plan.lane]} 人` })

    // 大团拆批
    if (b.size >= BIG_GROUP) {
      const batches = Math.ceil(b.size / BATCH_LIMIT)
      issues.push({
        level: 'warn',
        text: `${b.size} 人为大团（≥${BIG_GROUP}），建议拆 ${batches} 批、每批 ≤${BATCH_LIMIT} 人，间隔 ${ENTRY_SLOT} 分钟入场`
      })
    }

    // 耳麦
    if (b.needHeadsets) {
      if (b.headsetNeeded > headsetAvailable.value)
        issues.push({
          level: 'block',
          text: `耳麦库存不足：需 ${b.headsetNeeded} 台，当前可借 ${headsetAvailable.value} 台`
        })
      else
        issues.push({
          level: 'ok',
          text: `耳麦库存充足：需 ${b.headsetNeeded} 台 / 可借 ${headsetAvailable.value} 台，押金 ¥${(b.headsetNeeded * DEPOSIT_PER).toLocaleString()}`
        })
    }

    // 儿童团进安静厅
    const kids = b.ageLayers.幼儿 + b.ageLayers.儿童
    if (kids > 0 && kids / b.size >= 0.5) {
      const quietStops = plan.route.filter((s) => hall(s.hallId).quiet && !hall(s.hallId).childFriendly)
      if (quietStops.length)
        issues.push({
          level: 'warn',
          text: `儿童占比高（${kids}/${b.size}），路线含 ${quietStops.length} 个安静展区，需安排分组轻声讲解、避开讲解团队`
        })
    }
    return issues
  }

  // —— 时间线 ——
  function log(
    b: Booking,
      kind: EventKind,
    title: string,
    detail: string,
    tag: EventTag,
    extra: Partial<TimelineEvent> = {}
  ) {
    events.value.unshift({
      id: uid('E'),
      bookingId: b.id,
      at: extra.at ?? now.value,
      kind,
      title,
      detail,
      tag,
      ...extra
    })
  }

  // —— 写操作：预约 ——
  function createBooking(draft: BookingDraft): string {
    const maxSuffix = bookingList.value.reduce((m, b) => {
      const n = Number(b.id.split('-')[1])
      return Number.isFinite(n) ? Math.max(m, n) : m
    }, 2400)
    const id = `B-${maxSuffix + 1}`
    const b: Booking = {
      ...draft,
      id,
      status: '待确认',
      createdAt: now.value,
      headsets: [],
      depositPer: DEPOSIT_PER,
      route: []
    }
    bookingList.value.unshift(b)
    log(
      b,
      '预约提交',
      '团体预约提交',
      `${draft.orgName}（${draft.orgType}）${draft.size} 人报名「${draft.theme}」，预约 ${m2hm(draft.arriveAt)} 到馆。`,
      'info'
    )
    return id
  }

  function confirm(id: string, plan: ConfirmPlan) {
    const b = getBooking(id)
    if (!b) return
    Object.assign(b, {
      status: '已确认' as const,
      confirmedAt: now.value,
      guideId: plan.guideId,
      batchStart: plan.batchStart,
      lane: plan.lane,
      plannedDuration: plan.plannedDuration,
      route: structuredClone(plan.route)
    })
    b.batches = []
    for (let i = 0, n = b.size; n > 0; i++, n -= BATCH_LIMIT) {
      b.batches.push({ at: plan.batchStart + i * ENTRY_SLOT, size: Math.min(BATCH_LIMIT, n) })
    }
    const g = guideById(b.guideId)
    const hallsText = plan.route.map((s) => hallById(s.hallId)?.name.replace(/^[一二三四]层·/, '')).join('→')
    log(
      b,
      '确认预约',
      '预约已确认',
      `讲解员 ${g?.name ?? ''}；${m2hm(plan.batchStart)} ${plan.lane} 入场${b.batches.length > 1 ? `，拆 ${b.batches.length} 批` : ''}；路线 ${hallsText}，计划讲解 ${plan.plannedDuration} 分钟。`,
      'ok',
      { guideId: b.guideId, changeFrom: '待确认', changeTo: '已确认' }
    )
  }

  function reject(id: string, reason: string) {
    const b = getBooking(id)
    if (!b) return
    b.status = '已驳回'
    b.rejectReason = reason
    log(b, '驳回预约', '预约已驳回', `驳回原因：${reason}`, 'bad', { changeFrom: '待确认', changeTo: '已驳回' })
  }

  // —— 到馆 ——
  function arrive(id: string, adults: number, children: number, note: string) {
    const b = getBooking(id)
    if (!b) return
    const total = adults + children
    b.status = '已到馆'
    b.actualArrive = now.value
    b.actualSize = { adults, children, total }
    b.securityNote = note
    const diff = now.value - b.arriveAt
    const tag: EventTag = diff >= 5 ? 'warn' : 'ok'
    log(
      b,
      diff >= 5 ? '团体迟到' : '到馆核验',
      diff >= 5 ? `团体晚到 ${diff} 分钟` : '到馆核验通过',
      `现场核验实到 ${total} 人（成人 ${adults} / 儿童 ${children}，预约 ${b.size} 人）。${note}`,
      tag,
      { changeFrom: `预约 ${m2hm(b.arriveAt)}`, changeTo: `实到 ${m2hm(now.value)}` }
    )
  }

  function issueHeadsets(id: string, count: number) {
    const b = getBooking(id)
    if (!b) return
    const units: HeadsetUnit[] = Array.from({ length: count }, (_, i) => ({
      code: `${b.id}-M${String(i + 1).padStart(2, '0')}`,
      state: '已发'
    }))
    b.headsets = units
    b.depositTotal = count * b.depositPer
    log(b, '发放耳麦', `发放耳麦 ${count} 台`, `押金 ¥${b.depositTotal.toLocaleString()} 已预收，离馆凭设备归还情况结算。`, 'ok', {
      changeTo: `押金 ¥${b.depositTotal.toLocaleString()}`
    })
  }

  function setBatch(id: string, at: number, lane: Lane) {
    const b = getBooking(id)
    if (!b) return
    const old = `${b.lane ?? ''} ${b.batchStart ? m2hm(b.batchStart) : ''}`
    b.batchStart = at
    b.lane = lane
    log(b, '入馆批次', '入场批次调整', `批次改至 ${m2hm(at)} ${lane}。`, 'warn', {
      changeFrom: old.trim(),
      changeTo: `${lane} ${m2hm(at)}`
    })
  }

  /** 入馆：状态转讲解中，首个计划展厅开始 */
  function admit(id: string) {
    const b = getBooking(id)
    if (!b || !b.route.length) return
    b.status = '讲解中'
    b.enteredAt = now.value
    const first = b.route.find((s) => s.state === '计划')
    if (first) {
      first.state = '参观中'
      first.actualEnter = now.value
    }
    log(
      b,
      '入馆批次',
      `${b.lane ?? ''} 入场`,
      `${b.actualSize?.total ?? b.size} 人通过安检${b.batches && b.batches.length > 1 ? `，本批入场（共 ${b.batches.length} 批）` : ''}。`,
      'ok',
      { hallId: first?.hallId }
    )
    if (first)
      log(b, '到达展厅', `进入 ${hallById(first.hallId)?.name}`, `按确认路线开始讲解。`, 'info', { hallId: first.hallId })
  }

  // —— 讲解途中 ——
  function completeCurrent(id: string) {
    const b = getBooking(id)
    if (!b) return
    const cur = b.route.find((s) => s.state === '参观中')
    if (!cur) return
    cur.state = '已完成'
    cur.actualLeave = now.value
    log(
      b,
      '完成展厅',
      `离开 ${hallById(cur.hallId)?.name}`,
      `实际用时 ${(cur.actualLeave ?? 0) - (cur.actualEnter ?? 0)} 分钟（计划 ${cur.plannedDuration} 分钟）。`,
      'ok',
      { hallId: cur.hallId }
    )
  }

  function enterHall(id: string, hallId: string) {
    const b = getBooking(id)
    if (!b) return
    const target = b.route.find((s) => s.hallId === hallId && (s.state === '计划' || s.state === '拥堵改道'))
    if (target) {
      target.state = '参观中'
      target.actualEnter = now.value
    }
    log(b, '到达展厅', `进入 ${hallById(hallId)?.name}`, `团队转入该展厅参观。`, 'info', { hallId })
  }

  /** 路线调整：按新的展厅顺序重排剩余计划（已完成与正在参观的展厅保持不变） */
  function reroute(id: string, orderedHallIds: string[], reason: 'crowd' | 'guest' | 'maintenance' | 'guide') {
    const b = getBooking(id)
    if (!b) return
    const before = b.route
      .filter((s) => s.state === '计划' || s.state === '拥堵改道')
      .map((s) => hallById(s.hallId)?.name.replace(/^[一二三四]层·/, ''))
      .join('→')
    const done = b.route.filter((s) => s.state === '已完成')
    const current = b.route.find((s) => s.state === '参观中')
    const locked = new Set([...done.map((s) => s.hallId), ...(current ? [current.hallId] : [])])
    let cursor = current
      ? (current.actualEnter ?? now.value) + current.plannedDuration + 3
      : now.value
    const remaining: RouteStop[] = []
    for (const hid of orderedHallIds) {
      if (locked.has(hid)) continue
      const dur0 = THEME_ROUTE[b.theme].find((t) => t.hallId === hid)?.dur ?? 15
      remaining.push({ hallId: hid, plannedEnter: cursor, plannedDuration: dur0, state: '计划' })
      cursor += dur0 + 3
    }
    b.route = [...done, ...(current ? [current] : []), ...remaining]
    b.plannedDuration = routeDuration(b.route)
    const after = remaining.map((s) => hallById(s.hallId)?.name.replace(/^[一二三四]层·/, '')).join('→')
    const kind: EventKind = reason === 'crowd' ? '拥堵分流' : reason === 'maintenance' ? '展厅维护' : '路线调整'
    const titleMap = { crowd: '拥堵分流：调整参观顺序', maintenance: '展厅维护：调整参观顺序', guest: '游客要求改路线', guide: '配合讲解员变更重排' } as const
    const est = remaining.length ? remaining[remaining.length - 1].plannedEnter + remaining[remaining.length - 1].plannedDuration : cursor
    const snapshot = remaining
      .map((x) => {
        const c = crowdOf(x.hallId, Math.min(x.plannedEnter, now.value + 60))
        return `${hallById(x.hallId)?.name.replace(/^[一二三四]层·/, '').slice(0, 2)} ${c.occ}/${hallById(x.hallId)?.capacity}`
      })
      .join(' · ')
    log(
      b,
      kind,
      titleMap[reason],
      `后续路线更新为 ${after || '（已无展厅）'}；预计 ${m2hm(est)} 结束讲解，总时长修正为 ${b.plannedDuration} 分钟。`,
      reason === 'guest' ? 'info' : 'warn',
      { changeFrom: before || '（无）', changeTo: after || '（提前结束）', capacitySnapshot: snapshot || undefined }
    )
    propagateDownstream(b, est)
  }

  /** 跳过某展厅（游客要求/压缩时长） */
  function skipHall(id: string, hallId: string, note: string) {
    const b = getBooking(id)
    if (!b) return
    const s = b.route.find((x) => x.hallId === hallId && x.state === '计划')
    if (s) {
      s.state = '已跳过'
      s.note = note
    }
    b.plannedDuration = routeDuration(b.route.filter((x) => x.state !== '已跳过'))
    log(b, '路线调整', `跳过 ${hallById(hallId)?.name}`, `${note}；讲解时长修正为 ${b.plannedDuration} 分钟。`, 'warn', {
      hallId,
      changeFrom: `含 ${hallById(hallId)?.name.replace(/^[一二三四]层·/, '')}`,
      changeTo: '取消该展厅'
    })
  }

  /** 调整某展厅停留分钟数（讲解时长联动） */
  function resizeStop(id: string, hallId: string, dur: number) {
    const b = getBooking(id)
    if (!b) return
    const s = b.route.find((x) => x.hallId === hallId)
    if (!s) return
    s.plannedDuration = dur
    b.plannedDuration = routeDuration(b.route.filter((x) => x.state !== '已跳过'))
  }

  /** 调整后联动后续团队入场时隙（同通道） */
  function propagateDownstream(b: Booking, estLeave: number) {
    const slot = Math.ceil(estLeave / ENTRY_SLOT) * ENTRY_SLOT
    for (const other of bookingList.value) {
      if (other.id === b.id || !ACTIVE.includes(other.status) || other.status === '讲解中') continue
      if (other.lane !== b.lane) continue
      if (other.batchStart !== undefined && other.batchStart < slot && other.batchStart >= now.value - ENTRY_SLOT) {
        const old = other.batchStart
        other.batchStart = slot
        log(
          other,
          '系统提示',
          '后续团队入场顺延',
          `前序团体 ${b.id}（${b.orgName}）路线调整预计 ${m2hm(estLeave)} 结束，为避免 ${b.lane} 缓冲区叠加，本团入场由 ${m2hm(old)} 顺延至 ${m2hm(slot)}。`,
          'warn',
          changeLink(old, slot, b.lane)
        )
      }
    }
  }

  function changeLink(old: number, next: number, lane?: Lane) {
    return { changeFrom: `${lane ?? ''} ${m2hm(old)}`, changeTo: `${lane ?? ''} ${m2hm(next)}` }
  }

  function changeGuide(id: string, guideId: string, reason: string) {
    const b = getBooking(id)
    if (!b) return
    const old = guideById(b.guideId)
    const g = guideById(guideId)!
    b.guideId = guideId
    log(
      b,
      '讲解员变更',
      '讲解员临时替换',
      `${old?.name ?? '原讲解员'} → ${g.name}（${g.title}，${g.langs.join('/')}）。原因：${reason}；交接与路线已同步。`,
      'warn',
      { guideId, changeFrom: old?.name ?? '原讲解员', changeTo: `${g.name}（${g.id}）` }
    )
  }

  function childLost(id: string, hallId: string, detail: string, foundMin: number) {
    const b = getBooking(id)
    if (!b) return
    log(
      b,
      '儿童走散',
      '儿童走散（已寻回）',
      `${detail}；${foundMin} 分钟后寻回归队，后续展厅顺延 ${foundMin} 分钟。`,
      'bad',
      { hallId, changeFrom: '发现离队', changeTo: `${foundMin} 分钟后归队` }
    )
    const cur = b.route.find((s) => s.state === '参观中')
    if (cur) cur.actualLeave = (cur.actualLeave ?? now.value) + foundMin
    for (const s of b.route) if (s.state === '计划') s.plannedEnter += foundMin
    propagateDownstream(b, now.value + foundMin + remainingMin(b))
  }

  function remainingMin(b: Booking) {
    return b.route.filter((s) => s.state === '计划').reduce((n, s) => n + s.plannedDuration + 3, 0)
  }

  // —— 设备 ——
  function markHeadset(id: string, code: string, state: HeadsetUnit['state'], issue: string) {
    const b = getBooking(id)
    const u = b?.headsets.find((h) => h.code === code)
    if (!u) return
    const old = u.state
    u.state = state
    u.issue = state === '已发' ? undefined : issue
    if (state === '损坏' || state === '遗失') {
      log(
        b!,
        '设备事故',
        state === '损坏' ? `耳麦 ${code} 损坏` : `耳麦 ${code} 遗失`,
        issue,
        'bad',
        { changeFrom: `状态：${old}`, changeTo: `状态：${state}`, capacitySnapshot: `押金 ¥${b!.depositTotal?.toLocaleString()}` }
      )
    } else {
      log(b!, '归还设备', `耳麦 ${code} 状态更新为${state}`, issue || '设备复检正常。', 'ok', {
        changeFrom: old,
        changeTo: state
      })
    }
  }

  function returnAllHeadsets(id: string) {
    const b = getBooking(id)
    if (!b) return
    const n = b.headsets.filter((u) => u.state === '已发').length
    for (const u of b.headsets) if (u.state === '已发') {
      u.state = '已还'
      u.issue = undefined
    }
    if (n > 0) log(b, '归还设备', `批量复检归还 ${n} 台耳麦`, '前台逐台清点后批量登记复检正常；损坏/遗失设备保留原状态与费用记录。', 'ok')
  }

  // —— 展厅维护 ——
  function reportMaintenance(hallId: string, start: number, end: number, reason: string) {
    const hall = hallById(hallId)!
    closureList.value.push({ id: uid('C'), hallId, start, end, reason: reason as Closure['reason'] })
    if (now.value >= start && now.value < end) {
      hall.status = reason === '临时闭展' ? '临时闭展' : '维护'
      hall.statusNote = `${m2hm(start)}–${m2hm(end)} ${reason}`
    }
    for (const b of bookingList.value) {
      const hit = b.route.find((s) => s.hallId === hallId && (s.state === '计划' || s.state === '参观中'))
      if (!hit) continue
      log(
        b,
        '展厅维护',
        `${hall.name} 临时${reason}`,
        `${m2hm(start)}–${m2hm(end)} ${reason}，原计划 ${m2hm(hit.plannedEnter)} 进入该厅的安排需改道或顺延；同团后续顺序与团队入场时隙联动重排。`,
        'bad',
        { hallId, changeFrom: `计划 ${m2hm(hit.plannedEnter)} 进入`, changeTo: '待改道' }
      )
      if (hit.state === '计划') {
        hit.state = '拥堵改道'
        hit.note = `${reason}，待改道`
      }
    }
  }

  // —— 离馆 ——
  function checkout(id: string, satisfaction: number) {
    const b = getBooking(id)
    if (!b) return
    const st = settlement(b)
    b.status = '已离馆'
    b.actualLeave = now.value
    b.satisfaction = satisfaction
    for (const h of b.headsets) if (h.state === '已发') h.state = '已还'
    log(
      b,
      '归还设备',
      '耳麦归还与押金结算',
      `发出 ${st.issued} 台：完好归还 ${st.returned + st.outstanding}、损坏 ${st.damaged}、遗失 ${st.lost}；押金 ¥${(
        b.depositTotal ?? 0
      ).toLocaleString()}，维修费 ¥${st.damageFee}、遗失赔偿 ¥${st.lostFee}，实际退还 ¥${st.refund.toLocaleString()}。`,
      st.damaged + st.lost > 0 ? 'warn' : 'ok',
      {
        changeFrom: `押金 ¥${(b.depositTotal ?? 0).toLocaleString()}`,
        changeTo: `退还 ¥${st.refund.toLocaleString()}`
      }
    )
    const actual = b.route
      .filter((s) => s.state === '已完成')
      .reduce((n, s) => n + ((s.actualLeave ?? 0) - (s.actualEnter ?? 0)), 0)
    log(
      b,
      '离馆结算',
      `离馆 · 满意度 ${satisfaction}/5`,
      `实际讲解约 ${actual} 分钟（计划 ${b.plannedDuration} 分钟）；感谢反馈，用于排班与限流优化。`,
      satisfaction <= 3 ? 'warn' : 'ok',
      { changeTo: `满意度 ${satisfaction}/5` }
    )
  }

  // —— 投诉 ——
  function addComplaint(id: string, type: Complaint['type'], detail: string) {
    const b = getBooking(id)
    if (!b) return
    b.complaint = { type, detail, at: now.value, resolved: false }
    log(
      b,
      '投诉登记',
      `投诉：${type}`,
      detail,
      'bad'
    )
  }
  function resolveComplaint(id: string, note: string) {
    const b = getBooking(id)
    if (!b || !b.complaint) return
    b.complaint.resolved = true
    b.complaint.handleNote = note
    log(b, '投诉处理', '投诉已处理并归档', note, 'ok', { changeFrom: '待处理', changeTo: '已处理' })
  }

  // —— 列表聚合 ——
  const pending = computed(() => bookingList.value.filter((b) => b.status === '待确认'))
  const openComplaints = computed(() => bookingList.value.filter((b) => b.complaint && !b.complaint.resolved))
  const inMuseumVisitors = computed(() =>
    bookingList.value
      .filter((b) => b.status === '讲解中' || b.status === '已到馆')
      .reduce((n, b) => n + (b.actualSize?.total ?? b.size), 0)
  )
  const guidingTeams = computed(() => bookingList.value.filter((b) => b.status === '讲解中'))
  const waitingTeams = computed(() => bookingList.value.filter((b) => b.status === '已到馆'))

  return {
    // state
    hallList,
    exhibitList,
    guideList,
    closureList,
    bookingList,
    events,
    now,
    spots,
    // queries
    hallById,
    guideById,
    exhibitsOf,
    getBooking,
    eventsOf,
    closureActive,
    closureOverlap,
    projectedBase,
    liveOccupancy,
    crowdOf,
    alternativeHalls,
    guideBusyWindows,
    guideAvailable,
    buildRoute,
    routeDuration,
    suggestPlan,
    evaluate,
    settlement,
    // ops
    createBooking,
    confirm,
    reject,
    arrive,
    issueHeadsets,
    setBatch,
    admit,
    completeCurrent,
    enterHall,
    reroute,
    skipHall,
    resizeStop,
    changeGuide,
    childLost,
    markHeadset,
    returnAllHeadsets,
    reportMaintenance,
    checkout,
    addComplaint,
    resolveComplaint,
    log,
    // computed
    issuedHeadsets,
    headsetAvailable,
    depositHeld,
    pending,
    openComplaints,
    inMuseumVisitors,
    guidingTeams,
    waitingTeams,
    LANE_BASE,
    LANE_CAP
  }
})
