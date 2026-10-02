/** 当日时刻（HH:mm）与分钟数换算工具 */

export function toMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function toHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addHM(hm: string, deltaMin: number): string {
  return toHM(toMin(hm) + deltaMin)
}

export function hmOfISO(iso: string): string {
  return iso.slice(11, 16)
}

export function dateOfISO(iso: string): string {
  return iso.slice(0, 10)
}

/** 半开区间 [aS,aE) 与 [bS,bE) 是否重叠（分钟数） */
export function overlap(aS: number, aE: number, bS: number, bE: number): boolean {
  return aS < bE && bS < aE
}

/** 15 分钟安检批次槽，如 10:30 -> "10:30-10:45" */
export function slotKey(hm: string): string {
  const m = toMin(hm)
  const s = Math.floor(m / 15) * 15
  return `${toHM(s)}-${toHM(s + 15)}`
}

export function slotStart(hm: string): string {
  return slotKey(hm).split('-')[0]
}

export function durationHM(hm1: string, hm2: string): number {
  return toMin(hm2) - toMin(hm1)
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}
