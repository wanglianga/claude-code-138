import type {
  Guide,
  Hall,
  HallClosure,
  Reservation,
  RouteStop,
  SecurityLane,
  Theme,
} from '@/types'
import { addHM, durationHM, hmOfISO, overlap, toMin } from './time'
import { TOUR_INTERVAL_MIN } from '@/data/museum'

/** 有效闭馆时间 = 展厅静态闭展 + 工作人员临时登记的维护 */
export function closureAt(
  hall: Hall,
  hm: string,
  live: Record<string, HallClosure>,
): HallClosure | undefined {
  const m = toMin(hm)
  const all = [...hall.closures]
  if (live[hall.id]) all.push(live[hall.id])
  return all.find((c) => m >= toMin(c.start) && m < toMin(c.end))
}

export function isClosedAt(
  hall: Hall,
  hm: string,
  live: Record<string, HallClosure> = {},
): boolean {
  return !!closureAt(hall, hm, live)
}

/** 团队某站的有效时间：途中已发生用实际，未发生用计划 */
function effectiveWindow(stop: RouteStop): { enter: string; leave: string } {
  return {
    enter: stop.actualEnter ?? stop.plannedEnter,
    leave: stop.actualLeave ?? stop.plannedLeave,
  }
}

/** 仍占用展厅容量的团队：已确认 / 已到馆 / 参观中 */
export const OCCUPYING_STATUSES = ['confirmed', 'arrived', 'touring'] as const

export interface LiveState {
  maintenance: Record<string, HallClosure>
  /** 散客/其他团队实时占用（展厅探头人工录入） */
  extraLoad: Record<string, number>
}

/**
 * 展厅 15 分钟栅格占用：Map<hallId, Map<槽起点分钟, 团队人数>>
 */
export function occupancyGrid(
  reservations: Reservation[],
  live: LiveState = { maintenance: {}, extraLoad: {} },
): Map<string, Map<number, number>> {
  const grid = new Map<string, Map<number, number>>()
  const add = (hallId: string, startMin: number, endMin: number, size: number) => {
    let row = grid.get(hallId)
    if (!row) {
      row = new Map()
      grid.set(hallId, row)
    }
    for (let t = Math.floor(startMin / 15) * 15; t < endMin; t += 15) {
      row.set(t, (row.get(t) ?? 0) + size)
    }
  }
  for (const r of reservations) {
    if (!OCCUPYING_STATUSES.includes(r.status as (typeof OCCUPYING_STATUSES)[number])) continue
    const size = r.verifiedSize ?? r.groupSize
    for (const stop of r.route) {
      if (stop.state === 'skipped' || stop.state === 'maintenance') continue
      const w = effectiveWindow(stop)
      add(stop.hallId, toMin(w.enter), toMin(w.leave), size)
    }
  }
  for (const [hallId, extra] of Object.entries(live.extraLoad ?? {})) {
    if (extra > 0) {
      // 散客视为全天均匀占用（运营当日视角）
      for (let t = 9 * 60; t < 17 * 60; t += 15) add(hallId, t, t + 15, extra)
    }
  }
  return grid
}

/** 查询某展厅在某时刻的预计在场人数与满载率 */
export function hallLoadAt(
  hall: Hall,
  hm: string,
  grid: Map<string, Map<number, number>>,
): { load: number; capacity: number; ratio: number } {
  const slot = Math.floor(toMin(hm) / 15) * 15
  const load = grid.get(hall.id)?.get(slot) ?? 0
  return { load, capacity: hall.capacity, ratio: hall.capacity ? load / hall.capacity : 0 }
}

/** 整个团队路线期间，每一站的满载率峰值（确认预约时用） */
export function routePeakLoads(
  stops: RouteStop[],
  halls: Hall[],
  grid: Map<string, Map<number, number>>,
): { hallId: string; ratio: number; load: number; capacity: number }[] {
  return stops
    .filter((s) => s.state !== 'skipped' && s.state !== 'maintenance')
    .map((s) => {
      const hall = halls.find((h) => h.id === s.hallId)!
      let peak = 0
      for (let t = toMin(s.plannedEnter); t < toMin(s.plannedLeave); t += 15) {
        peak = Math.max(peak, grid.get(s.hallId)?.get(Math.floor(t / 15) * 15) ?? 0)
      }
      return {
        hallId: s.hallId,
        load: peak,
        capacity: hall.capacity,
        ratio: hall.capacity ? peak / hall.capacity : 0,
      }
    })
}

/** 讲解员当日带团窗口（含前后 10 分钟交接缓冲） */
export function guideBusyWindows(
  reservations: Reservation[],
  guideId: string,
): { start: number; end: number; reservation: Reservation }[] {
  const out: { start: number; end: number; reservation: Reservation }[] = []
  for (const r of reservations) {
    if (!r.assignedGuideIds.includes(guideId)) continue
    if (r.status === 'rejected' || r.status === 'cancelled' || r.status === 'completed') continue
    const active = r.route.filter((s) => s.state !== 'skipped' && s.state !== 'maintenance')
    if (!active.length) continue
    const first = active[0]
    const last = active[active.length - 1]
    out.push({
      start: toMin(first.actualEnter ?? first.plannedEnter) - TOUR_INTERVAL_MIN,
      end: toMin(last.actualLeave ?? last.plannedLeave) + TOUR_INTERVAL_MIN,
      reservation: r,
    })
  }
  return out
}

export interface GuideCandidate extends Guide {
  ok: boolean
  conflicts: string[] // 冲突原因
}

/** 为某语言/主题/时段匹配合适讲解员 */
export function availableGuides(
  guides: Guide[],
  reservations: Reservation[],
  opts: { language: string; themeId: string; startHM: string; endHM: string },
): GuideCandidate[] {
  const s = toMin(opts.startHM)
  const e = toMin(opts.endHM)
  return guides.map((g) => {
    const conflicts: string[] = []
    if (!g.langs.includes(opts.language as Guide['langs'][number]))
      conflicts.push(`不支持${opts.language === 'zh' ? '中文' : opts.language === 'en' ? '英语' : '日语'}`)
    if (!g.themes.includes(opts.themeId)) conflicts.push('不熟悉该讲解主题')
    const inShift = g.shifts.some((sh) => s >= toMin(sh.start) && e <= toMin(sh.end))
    if (!inShift) conflicts.push('排班时段不覆盖')
    const clash = guideBusyWindows(reservations, g.id).find((w) => overlap(s, e, w.start, w.end))
    if (clash) conflicts.push(`与「${clash.reservation.orgName}」带团时间冲突`)
    return { ...g, ok: conflicts.length === 0, conflicts }
  })
}

/** 大团拆分入馆批次 */
export function splitBatches(size: number, perBatch = 25): number[] {
  const batches: number[] = []
  let rest = size
  while (rest > 0) {
    const n = Math.min(perBatch, rest)
    batches.push(n)
    rest -= n
  }
  return batches
}

/** 安检通道安排：按到馆 15 分钟槽聚合已确认人数 */
export function securityPlan(
  lanes: SecurityLane[],
  reservations: Reservation[],
  arriveHM: string,
  size: number,
  accessible: boolean,
  selfId?: string,
): { lane: SecurityLane; slot: string; loadBefore: number; loadAfter: number; waitSlots: number }[] {
  const slot = Math.floor(toMin(arriveHM) / 15) * 15
  const slotKey = `${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`
  const used = new Map<string, number>()
  for (const r of reservations) {
    if (!OCCUPYING_STATUSES.includes(r.status as (typeof OCCUPYING_STATUSES)[number])) continue
    if (r.id === selfId || !r.securityLane) continue
    const hm = r.actualArrive ? hmOfISO(r.actualArrive) : hmOfISO(r.arriveTime)
    if (Math.floor(toMin(hm) / 15) * 15 !== slot) continue
    used.set(r.securityLane, (used.get(r.securityLane) ?? 0) + (r.verifiedSize ?? r.groupSize))
  }
  // 需无障碍时优先无障碍通道，同时给出普通通道备选；否则隐藏无障碍专道
  const ordered = accessible
    ? [...lanes].sort((a, b) => Number(!!b.accessibleOnly) - Number(!!a.accessibleOnly))
    : lanes.filter((l) => !l.accessibleOnly)
  return ordered.map((lane) => {
    const before = used.get(lane.id) ?? 0
    const after = before + size
    const waitSlots = Math.max(0, Math.ceil(after / lane.perSlot) - 1)
    return { lane, slot: slotKey, loadBefore: before, loadAfter: after, waitSlots }
  })
}

/**
 * 按主题生成路线：顺排展厅、分配时长、避让闭展与无障碍不可达
 */
export function buildRoute(
  theme: Theme,
  halls: Hall[],
  startHM: string,
  opts: { accessible: boolean; live?: Record<string, HallClosure> } = {
    accessible: false,
  },
): RouteStop[] {
  const live = opts.live ?? {}
  const per = Math.floor(theme.durationMin / theme.hallIds.length)
  let cursor = toMin(startHM)
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  return theme.hallIds.map((hallId, idx) => {
    const hall = halls.find((h) => h.id === hallId)!
    const dur = idx === theme.hallIds.length - 1
      ? theme.durationMin - per * (theme.hallIds.length - 1)
      : per
    let enter = cursor
    let leave = cursor + dur
    let state: RouteStop['state'] = 'planned'
    let note: string | undefined

    if (opts.accessible && !hall.accessible) {
      state = 'skipped'
      note = '该展厅暂不支持无障碍通行，已从路线移除'
    } else {
      const closed = hall.closures
        .concat(live[hallId] ? [live[hallId]] : [])
        .find((c) => overlap(enter, leave, toMin(c.start), toMin(c.end)))
      if (closed) {
        const reopen = toMin(closed.end)
        if (reopen < leave + 20) {
          // 闭展结束后仍可补看：顺延本站，后续站整体后移
          enter = Math.max(enter, reopen + 5)
          leave = enter + dur
          note = `${closed.reason}（${closed.start}-${closed.end}），已顺延至 ${fmt(enter)}`
          cursor = enter
        } else {
          state = 'maintenance'
          note = `${closed.reason}（${closed.start}-${closed.end}），当日无法参观`
        }
      }
    }

    const stop: RouteStop = {
      hallId,
      plannedEnter: fmt(enter),
      plannedLeave: fmt(state === 'maintenance' ? cursor + dur : leave),
      durationMin: dur,
      state,
      note,
    }
    if (state !== 'maintenance' && state !== 'skipped') cursor = leave + 5
    return stop
  })
}

export interface RerouteCandidate {
  hall: Hall
  score: number
  reasons: string[]
  enterHM: string
  ratio: number
}

/**
 * 途中智能改道：给出可替换/增补展厅建议
 * 综合：同主题、儿童友好、无障碍、实时满载率、相邻少走动、热门展品、安静等级
 */
export function suggestReroute(
  reservation: Reservation,
  blockedHallId: string,
  halls: Hall[],
  grid: Map<string, Map<number, number>>,
  live: LiveState,
  nowHM: string,
): RerouteCandidate[] {
  const visited = new Set(
    reservation.route.filter((s) => s.state === 'done').map((s) => s.hallId),
  )
  const kids = reservation.ageBand === 'children' || reservation.ageBand === 'mixed'
  const blocked = halls.find((h) => h.id === blockedHallId)
  const adjacent = new Set(blocked?.nearTo ?? [])

  return halls
    .filter((h) => h.id !== blockedHallId && !visited.has(h.id))
    .filter((h) => !(reservation.accessible && !h.accessible))
    .filter((h) => !isClosedAt(h, nowHM, live.maintenance))
    .map((hall) => {
      let score = 0
      const reasons: string[] = []
      const { ratio } = hallLoadAt(hall, nowHM, grid)
      score -= Math.round(ratio * 200)
      if (hall.themes.includes(reservation.themeId)) {
        score += 100
        reasons.push('属于本团讲解主题')
      }
      if (kids && hall.childFriendly) {
        score += 40
        reasons.push('儿童友好展厅')
      }
      if (!kids && hall.quiet === 3) {
        score += 20
        reasons.push('安静展厅，适合深度观展')
      }
      if (reservation.accessible && hall.accessible) reasons.push('无障碍可达')
      if (adjacent.has(hall.id)) {
        score += 25
        reasons.push('与当前位置相邻，步行 ≤ 2 分钟')
      }
      if (ratio < 0.5) reasons.push('当前人流稀疏')
      else if (ratio >= 0.85) reasons.push('即将达到限流阈值')
      if (hall.exhibits.some((e) => e.hot)) reasons.push('含热门展品')
      if (hall.exhibits.some((e) => e.noPhoto)) reasons.push('含禁止拍照展品，需提前提醒')
      score += Math.round((hall.capacity / 120) * 15)
      return {
        hall,
        score,
        reasons,
        enterHM: addHM(nowHM, adjacent.has(hall.id) ? 2 : 6),
        ratio,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

export interface DownstreamConflict {
  reservation: Reservation
  hallId: string
  hm: string
  loadAfter: number
  capacity: number
}

/**
 * 评估某团队新路线对后续团队入场的影响：逐槽叠加后是否突破展厅容量
 */
export function downstreamImpact(
  target: Reservation,
  newStops: RouteStop[],
  reservations: Reservation[],
  halls: Hall[],
  extraDelayMin = 0,
): DownstreamConflict[] {
  const others = reservations.filter(
    (r) =>
      r.id !== target.id &&
      OCCUPYING_STATUSES.includes(r.status as (typeof OCCUPYING_STATUSES)[number]),
  )
  const grid = occupancyGrid(others)
  const size = target.verifiedSize ?? target.groupSize
  const conflicts: DownstreamConflict[] = []

  for (const stop of newStops) {
    if (stop.state === 'skipped' || stop.state === 'maintenance') continue
    const s = toMin(stop.plannedEnter) + extraDelayMin
    const e = toMin(stop.plannedLeave) + extraDelayMin
    const hall = halls.find((h) => h.id === stop.hallId)!
    for (let t = Math.floor(s / 15) * 15; t < e; t += 15) {
      const load = (grid.get(hall.id)?.get(t) ?? 0) + size
      if (load > hall.capacity) {
        const owner = others.find((r) =>
          r.route.some((rs) => {
            if (rs.hallId !== hall.id || rs.state === 'skipped' || rs.state === 'maintenance')
              return false
            const w = effectiveWindow(rs)
            return t >= toMin(w.enter) && t < toMin(w.leave)
          }),
        )
        if (owner) {
          conflicts.push({
            reservation: owner,
            hallId: hall.id,
            hm: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
            loadAfter: load,
            capacity: hall.capacity,
          })
        }
      }
    }
  }
  // 去重
  const seen = new Set<string>()
  return conflicts.filter((c) => {
    const k = `${c.reservation.id}-${c.hallId}-${c.hm}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 计划讲解总时长（分钟） */
export function plannedDuration(stops: RouteStop[]): number {
  const active = stops.filter((s) => s.state !== 'skipped' && s.state !== 'maintenance')
  if (!active.length) return 0
  const first = active[0]
  const last = active[active.length - 1]
  return durationHM(first.plannedEnter, last.plannedLeave)
}
