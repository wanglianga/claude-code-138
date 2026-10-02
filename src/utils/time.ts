/** 分钟（自 00:00）与展示格式互转 */

export function m2hm(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function hm2m(s: string): number {
  const [h, mm] = s.split(':').map(Number)
  return h * 60 + mm
}

export function dur(min: number): string {
  if (min < 60) return `${min}分钟`
  const h = Math.floor(min / 60)
  const mm = min % 60
  return mm ? `${h}小时${mm}分` : `${h}小时`
}

export function money(n: number): string {
  return `¥${n.toLocaleString('zh-CN')}`
}

export function todayLabel(): string {
  return '2026-10-01'
}

/** 晚到分钟（正数=迟到，负数=早到） */
export function lateMin(planned: number, actual: number): number {
  return actual - planned
}

let seq = 0
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}${Date.now().toString(36)}${seq}`
}
