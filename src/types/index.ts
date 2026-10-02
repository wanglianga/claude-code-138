// 美术馆团体参观调度领域模型

export type OrgType = '学校' | '企业' | '旅行社'
export type Lang = '中文' | '英文' | '日文' | '手语'
export type AgeLayer = '幼儿' | '儿童' | '青少年' | '成人' | '长者'
export type ThemeId = '常设精选' | '特展专题' | '亲子探秘' | '建筑艺术' | '快速通览'

export const AGE_LAYERS: AgeLayer[] = ['幼儿', '儿童', '青少年', '成人', '长者']
export const LANGS: Lang[] = ['中文', '英文', '日文', '手语']
export const THEMES: ThemeId[] = ['常设精选', '特展专题', '亲子探秘', '建筑艺术', '快速通览']
export const ORG_TYPES: OrgType[] = ['学校', '企业', '旅行社']

/** 预约状态机：待确认 → 已确认 → 已到馆 → 讲解中 → 已离馆（可驳回/取消） */
export type BookingStatus =
  | '待确认'
  | '已确认'
  | '已驳回'
  | '已到馆'
  | '讲解中'
  | '已离馆'
  | '已取消'

export const STATUS_FLOW: BookingStatus[] = ['待确认', '已确认', '已到馆', '讲解中', '已离馆']

export interface Hall {
  id: string
  name: string
  floor: string
  /** 展厅瞬时容量（人） */
  capacity: number
  /** 模拟的散客实时客流基数 */
  baseOccupancy: number
  /** 适合儿童（亲子/低龄团体优先） */
  childFriendly: boolean
  /** 安静展区，团队错峰阈值更低 */
  quiet: boolean
  /** 无障碍可达 */
  accessible: boolean
  status: '开放' | '维护' | '临时闭展'
  statusNote?: string
}

export interface Exhibit {
  id: string
  hallId: string
  name: string
  /** 热门展品（吸引客流、易拥堵） */
  hot: boolean
  /** 禁止拍照/摄像 */
  noPhoto: boolean
  note?: string
}

export interface Guide {
  id: string
  name: string
  title: string
  langs: Lang[]
  themes: ThemeId[]
  /** 当班起止（分钟） */
  dutyStart: number
  dutyEnd: number
  phone: string
}

export interface Closure {
  id: string
  hallId: string
  start: number
  end: number
  reason: '展品轮换' | '设备维护' | '临时闭展'
}

export type StopState = '计划' | '参观中' | '已完成' | '已跳过' | '拥堵改道'

export interface RouteStop {
  hallId: string
  plannedEnter: number
  plannedDuration: number
  actualEnter?: number
  actualLeave?: number
  state: StopState
  note?: string
}

export type HeadsetState = '已发' | '已还' | '损坏' | '遗失'

export interface HeadsetUnit {
  code: string
  state: HeadsetState
  /** 损坏/遗失时记录的事件说明 */
  issue?: string
}

export type EventKind =
  | '预约提交'
  | '确认预约'
  | '驳回预约'
  | '到馆核验'
  | '发放耳麦'
  | '设备事故'
  | '归还设备'
  | '入馆批次'
  | '到达展厅'
  | '完成展厅'
  | '拥堵分流'
  | '路线调整'
  | '展厅维护'
  | '讲解员变更'
  | '儿童走散'
  | '团体迟到'
  | '离馆结算'
  | '投诉登记'
  | '投诉处理'
  | '系统提示'

export type EventTag = 'info' | 'ok' | 'warn' | 'bad'

export interface TimelineEvent {
  id: string
  bookingId: string
  at: number
  kind: EventKind
  title: string
  detail: string
  tag: EventTag
  hallId?: string
  guideId?: string
  /** 决策前 → 决策后，用于投诉溯源 */
  changeFrom?: string
  changeTo?: string
  /** 决策时的容量快照，如 48/60 */
  capacitySnapshot?: string
}

export type Lane = '团队通道A' | '团队通道B' | '无障碍优先通道'
export const LANES: Lane[] = ['团队通道A', '团队通道B', '无障碍优先通道']

export interface Complaint {
  type: '讲解缩水' | '等待过长' | '服务态度' | '其他'
  detail: string
  at: number
  resolved: boolean
  handleNote?: string
}

export interface PlannedBatch {
  /** 计划入场分钟 */
  at: number
  size: number
  /** 实际入场分钟 */
  entered?: number
}

export interface Booking {
  id: string
  orgType: OrgType
  orgName: string
  contactName: string
  contactPhone: string
  size: number
  ageLayers: Record<AgeLayer, number>
  lang: Lang
  accessible: boolean
  theme: ThemeId
  /** 计划到馆时间（分钟） */
  arriveAt: number
  busCount: number
  dockSpot: string
  needHeadsets: boolean
  headsetNeeded: number
  note: string
  status: BookingStatus
  createdAt: number

  // —— 工作人员确认 ——
  confirmedAt?: number
  guideId?: string
  batchStart?: number
  batches?: PlannedBatch[]
  lane?: Lane
  plannedDuration?: number
  rejectReason?: string

  // —— 到馆核验 ——
  actualArrive?: number
  actualSize?: sizeCheck
  securityNote?: string
  headsets: HeadsetUnit[]
  depositPer: number
  depositTotal?: number
  enteredAt?: number

  // —— 讲解路线 ——
  route: RouteStop[]

  // —— 离馆 ——
  actualLeave?: number
  satisfaction?: number
  complaint?: Complaint
}

export interface sizeCheck {
  adults: number
  children: number
  total: number
}

/** 预约表单输入（新建页） */
export interface BookingDraft {
  orgType: OrgType
  orgName: string
  contactName: string
  contactPhone: string
  size: number
  ageLayers: Record<AgeLayer, number>
  lang: Lang
  accessible: boolean
  theme: ThemeId
  arriveAt: number
  busCount: number
  dockSpot: string
  needHeadsets: boolean
  headsetNeeded: number
  note: string
}
