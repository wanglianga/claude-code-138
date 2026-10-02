import type {
  AgeLayer,
  Booking,
  Closure,
  Exhibit,
  Guide,
  Hall,
  HeadsetUnit,
  RouteStop,
  TimelineEvent
} from '@/types'

export function emptyAgeLayers(): Record<AgeLayer, number> {
  return { 幼儿: 0, 儿童: 0, 青少年: 0, 成人: 0, 长者: 0 }
}

export const halls: Hall[] = [
  {
    id: 'H1',
    name: '一层·历代书画厅',
    floor: '1F',
    capacity: 60,
    baseOccupancy: 51,
    childFriendly: false,
    quiet: true,
    accessible: true,
    status: '开放'
  },
  {
    id: 'H2',
    name: '一层·雕塑庭院',
    floor: '1F',
    capacity: 90,
    baseOccupancy: 22,
    childFriendly: true,
    quiet: false,
    accessible: true,
    status: '开放'
  },
  {
    id: 'H3',
    name: '二层·现代艺术馆',
    floor: '2F',
    capacity: 70,
    baseOccupancy: 18,
    childFriendly: false,
    quiet: true,
    accessible: true,
    status: '开放'
  },
  {
    id: 'H4',
    name: '二层·互动探索厅',
    floor: '2F',
    capacity: 50,
    baseOccupancy: 14,
    childFriendly: true,
    quiet: false,
    accessible: true,
    status: '开放'
  },
  {
    id: 'H5',
    name: '三层·浮世绘特展厅',
    floor: '3F',
    capacity: 55,
    baseOccupancy: 28,
    childFriendly: false,
    quiet: true,
    accessible: true,
    status: '开放'
  },
  {
    id: 'H6',
    name: '三层·陶瓷珍品阁',
    floor: '3F',
    capacity: 40,
    baseOccupancy: 0,
    childFriendly: false,
    quiet: true,
    accessible: false,
    status: '维护',
    statusNote: '10:00–11:30 展陈灯光检修，暂停开放'
  }
]

export const exhibits: Exhibit[] = [
  { id: 'E1', hallId: 'H1', name: '《溪山行旅图》摹本', hot: true, noPhoto: true, note: '纸本淡色，禁止闪光灯与拍照' },
  { id: 'E2', hallId: 'H1', name: '宋代花鸟册页', hot: false, noPhoto: true },
  { id: 'E3', hallId: 'H2', name: '北齐胁侍菩萨圆雕', hot: true, noPhoto: false, note: '庭院中央，团队易聚集' },
  { id: 'E4', hallId: 'H2', name: '汉代陶楼院落', hot: false, noPhoto: false },
  { id: 'E5', hallId: 'H3', name: '沉浸光影装置《潮》', hot: true, noPhoto: false, note: '每整点一场，入场需排队' },
  { id: 'E6', hallId: 'H3', name: '当代影像墙', hot: false, noPhoto: true, note: '影像作品，全程禁止摄像' },
  { id: 'E7', hallId: 'H4', name: '互动拓印台', hot: false, noPhoto: false, note: '每场限 16 名儿童参与' },
  { id: 'E8', hallId: 'H4', name: '文物拼图角', hot: false, noPhoto: false },
  { id: 'E9', hallId: 'H5', name: '葛饰北斋富岳三十六景', hot: true, noPhoto: true, note: '特展展品，禁止拍照' },
  { id: 'E10', hallId: 'H6', name: '汝窑天青釉洗', hot: true, noPhoto: true, note: '阁楼展区，仅楼梯可达' }
]

export const guides: Guide[] = [
  { id: 'G1', name: '林晚舟', title: '高级讲解员', langs: ['中文', '英文'], themes: ['常设精选', '特展专题', '建筑艺术'], dutyStart: 540, dutyEnd: 1020, phone: '内线 801' },
  { id: 'G2', name: '陈牧', title: '讲解员', langs: ['中文', '日文'], themes: ['常设精选', '快速通览', '特展专题'], dutyStart: 540, dutyEnd: 1020, phone: '内线 802' },
  { id: 'G3', name: '苏晓', title: '亲子教育专员', langs: ['中文'], themes: ['亲子探秘', '常设精选'], dutyStart: 540, dutyEnd: 900, phone: '内线 803' },
  { id: 'G4', name: '王峥', title: '双语讲解员', langs: ['中文', '英文', '手语'], themes: ['常设精选', '亲子探秘', '快速通览'], dutyStart: 660, dutyEnd: 1080, phone: '内线 804' },
  { id: 'G5', name: '赵岚', title: '志愿者讲解员', langs: ['中文'], themes: ['快速通览'], dutyStart: 540, dutyEnd: 780, phone: '内线 805' }
]

export const closures: Closure[] = [
  { id: 'C1', hallId: 'H6', start: 600, end: 690, reason: '设备维护' },
  { id: 'C2', hallId: 'H5', start: 840, end: 930, reason: '展品轮换' }
]

export const dockSpots = ['D1·南门大巴1位', 'D2·南门大巴2位', 'D3·南门大巴3位', 'D4·东门旅游车位', 'D5·地下中巴位']

function hs(count: number, state: '已发' | '已还' = '已发'): HeadsetUnit[] {
  return Array.from({ length: count }, (_, i) => ({ code: `M-${String(1000 + i)}`, state }))
}

/** 快速构造今早已离馆的历史团（供分析统计） */
function done(p: {
  id: string
  orgType: Booking['orgType']
  orgName: string
  contactName: string
  contactPhone: string
  size: number
  ageLayers: Record<AgeLayer, number>
  lang: Booking['lang']
  accessible: boolean
  theme: Booking['theme']
  arrive: number
  dockSpot: string
  busCount: number
  needHeadsets: boolean
  headsetNeeded: number
  guideId: string
  entered: number
  leave: number
  planned: number
  sat: number
  issue: string
  complaint?: Booking['complaint']
}): Booking {
  const damaged = p.issue.includes('损坏') || p.issue.includes('遗失')
  return {
    id: p.id,
    orgType: p.orgType,
    orgName: p.orgName,
    contactName: p.contactName,
    contactPhone: p.contactPhone,
    size: p.size,
    ageLayers: p.ageLayers,
    lang: p.lang,
    accessible: p.accessible,
    theme: p.theme,
    arriveAt: p.arrive,
    busCount: p.busCount,
    dockSpot: p.dockSpot,
    needHeadsets: p.needHeadsets,
    headsetNeeded: p.headsetNeeded,
    note: '',
    status: '已离馆',
    createdAt: p.arrive - 20,
    confirmedAt: p.arrive - 12,
    guideId: p.guideId,
    batchStart: p.entered,
    lane: '团队通道A',
    plannedDuration: p.planned,
    actualArrive: p.arrive,
    actualSize: { adults: p.ageLayers.成人 + p.ageLayers.长者, children: p.ageLayers.幼儿 + p.ageLayers.儿童 + p.ageLayers.青少年, total: p.size },
    securityNote: p.entered - p.arrive >= 15 ? `等待 ${p.entered - p.arrive} 分钟入场` : '',
    headsets: p.needHeadsets
      ? [
          ...hs(p.headsetNeeded - (damaged ? 1 : 0), '已还').map((u, i) => ({ ...u, code: `M-${3000 + i}` })),
          ...(damaged ? [{ code: 'M-3099', state: '损坏' as const, issue: p.issue }] : [])
        ]
      : [],
    depositPer: 200,
    depositTotal: p.needHeadsets ? p.headsetNeeded * 200 : 0,
    enteredAt: p.entered,
    route: [],
    actualLeave: p.leave,
    satisfaction: p.sat,
    complaint: p.complaint
  }
}

// —— B-2401 阳光小学：讲解中，经历迟到 / 走散 / 拥堵分流 ——
const route2401: RouteStop[] = [
  { hallId: 'H4', plannedEnter: 580, plannedDuration: 30, actualEnter: 581, actualLeave: 608, state: '已完成' },
  { hallId: 'H2', plannedEnter: 610, plannedDuration: 25, actualEnter: 609, actualLeave: 641, state: '已完成', note: '儿童走散延误 6 分钟' },
  { hallId: 'H3', plannedEnter: 643, plannedDuration: 22, actualEnter: 639, state: '参观中', note: '由 H1 拥堵分流插入' },
  { hallId: 'H1', plannedEnter: 655, plannedDuration: 15, state: '计划', note: '由 10:35 顺延至 10:55，错峰《溪山行旅图》观画客流' }
]

const events2401: TimelineEvent[] = [
  { id: 'T1-01', bookingId: 'B-2401', at: 552, kind: '预约提交', title: '团体预约提交', detail: '阳光小学三年级亲子团报名亲子探秘路线，预约 09:30 到馆。', tag: 'info' },
  { id: 'T1-02', bookingId: 'B-2401', at: 560, kind: '确认预约', title: '预约已确认', detail: '分配亲子教育专员苏晓；09:40 团队通道A 第一批入场；路线 H4→H2→H1。', tag: 'ok', guideId: 'G3', changeFrom: '待确认', changeTo: '已确认' },
  { id: 'T1-03', bookingId: 'B-2401', at: 575, kind: '团体迟到', title: '团体晚到 5 分钟', detail: '大巴 D3 位停靠，雨天路况迟到；现场核验实到 46 人（较预约多 2 名随行家长）。', tag: 'warn', changeFrom: '预约 44 人', changeTo: '实到 46 人' },
  { id: 'T1-04', bookingId: 'B-2401', at: 577, kind: '发放耳麦', title: '发放耳麦 30 台', detail: '儿童佩戴黄标接收器，押金 ¥6,000 已预收。', tag: 'ok', changeTo: '押金 ¥6,000' },
  { id: 'T1-05', bookingId: 'B-2401', at: 580, kind: '入馆批次', title: '第 1 批入场（通道A）', detail: '46 人未超单批上限，一批入场，安检用时 1 分钟。', tag: 'ok', capacitySnapshot: '通道A 12/40' },
  { id: 'T1-06', bookingId: 'B-2401', at: 581, kind: '到达展厅', title: '进入 互动探索厅', detail: '互动拓印台开场，分两组轮换。', tag: 'info', hallId: 'H4' },
  { id: 'T1-07', bookingId: 'B-2401', at: 608, kind: '完成展厅', title: '离开 互动探索厅', detail: '用时 27 分钟（计划 30 分钟）。', tag: 'ok', hallId: 'H4' },
  { id: 'T1-08', bookingId: 'B-2401', at: 612, kind: '儿童走散', title: '儿童走散（已寻回）', detail: '雕塑庭院内一名 9 岁男童脱离队伍前往文创柜；讲解员与保安 6 分钟后在一层文创区寻回，全员安全。', tag: 'bad', hallId: 'H2', changeFrom: '10:12 发现离队', changeTo: '10:18 寻回归队' },
  { id: 'T1-09', bookingId: 'B-2401', at: 636, kind: '拥堵分流', title: '书画厅拥堵，临时改道', detail: 'H1 实时 51/60（安静厅阈值 42 人），镇馆之宝展位聚集。调度先改至现代艺术馆 H3（18/70），H1 顺延 20 分钟错峰。', tag: 'warn', hallId: 'H1', changeFrom: 'H1（51/60 拥堵）', changeTo: 'H3（18/70 宽松）', capacitySnapshot: 'H1 51/60 · H3 18/70' },
  { id: 'T1-10', bookingId: 'B-2401', at: 639, kind: '路线调整', title: '后续顺序重排', detail: '路线更新为 H4→H2→H3→H1；预计 11:12 离馆，较原计划晚 22 分钟，不影响后续团队入场时隙。', tag: 'warn', changeFrom: 'H4→H2→H1', changeTo: 'H4→H2→H3→H1' },
  { id: 'T1-11', bookingId: 'B-2401', at: 639, kind: '到达展厅', title: '进入 现代艺术馆', detail: '观看《潮》整点场前半段。', tag: 'info', hallId: 'H3' }
]

// —— B-2402 华远科技：已到馆等待入场，受前序团队连锁影响 ——
const events2402: TimelineEvent[] = [
  { id: 'T2-01', bookingId: 'B-2402', at: 570, kind: '预约提交', title: '团体预约提交', detail: '华远科技外宾团 28 人，英文讲解，含 1 位轮椅访客，预约 10:00 到馆。', tag: 'info' },
  { id: 'T2-02', bookingId: 'B-2402', at: 575, kind: '确认预约', title: '预约已确认', detail: '英文高级讲解员林晚舟；原计划 10:15 团队通道A 入场；全程无障碍路线（避开 H6 阁楼）。', tag: 'ok', guideId: 'G1' },
  { id: 'T2-03', bookingId: 'B-2402', at: 605, kind: '到馆核验', title: '到馆核验通过', detail: '中巴停靠 D5，晚到 5 分钟；28 人全员到齐，轮椅访客 1 人。', tag: 'warn', changeFrom: '预约 10:00', changeTo: '实到 10:05' },
  { id: 'T2-04', bookingId: 'B-2402', at: 607, kind: '发放耳麦', title: '发放耳麦 28 台', detail: '英文频道 2 组，押金 ¥5,600。', tag: 'ok' },
  { id: 'T2-05', bookingId: 'B-2402', at: 615, kind: '入馆批次', title: '通道A 饱和，改通道B', detail: '通道A 散客排队 31 人，调度改走团队通道B，批次改至 10:20。', tag: 'warn', changeFrom: '通道A 10:15', changeTo: '通道B 10:20', capacitySnapshot: '通道A 31/40 · 通道B 14/40' },
  { id: 'T2-06', bookingId: 'B-2402', at: 630, kind: '系统提示', title: '前序团体延误，批次顺延', detail: 'B-2401 阳光小学因儿童走散与 H1 拥堵分流尚未完成 H3 参观，通道B 团队缓冲区占用；本团批次顺延至 10:45。', tag: 'warn', hallId: 'H3', changeFrom: '10:20', changeTo: '10:45', capacitySnapshot: '通道B 缓冲 22/30' }
]

// —— B-2407 博研教育：已离馆，设备损坏 + 讲解缩水/等待投诉 ——
const events2407: TimelineEvent[] = [
  { id: 'T7-01', bookingId: 'B-2407', at: 520, kind: '预约提交', title: '团体预约提交', detail: '博研教育研学团 36 人，快速通览，预约 09:00 到馆。', tag: 'info' },
  { id: 'T7-02', bookingId: 'B-2407', at: 528, kind: '确认预约', title: '预约已确认', detail: '志愿者讲解员赵岚；09:05 通道A 入场；路线 H2→H1→H3，计划讲解 45 分钟。', tag: 'ok', guideId: 'G5', changeTo: '计划讲解 45 分钟' },
  { id: 'T7-03', bookingId: 'B-2407', at: 540, kind: '到馆核验', title: '准点到馆', detail: '2 辆大巴 D1/D2 停靠，36 人全员到齐。', tag: 'ok' },
  { id: 'T7-04', bookingId: 'B-2407', at: 543, kind: '发放耳麦', title: '发放耳麦 20 台', detail: '押金 ¥4,000。', tag: 'ok' },
  { id: 'T7-05', bookingId: 'B-2407', at: 545, kind: '入馆批次', title: '早高峰安检排队', detail: '通道A 三个学生团叠加，实际 09:30 才通过安检，等待 25 分钟。', tag: 'bad', changeFrom: '计划 09:05 入场', changeTo: '实际 09:30 入场', capacitySnapshot: '通道A 38/40' },
  { id: 'T7-06', bookingId: 'B-2407', at: 566, kind: '讲解员变更', title: '讲解员临时替换', detail: '赵岚突发咽喉不适，经调度改由陈牧接替，交接 4 分钟。', tag: 'warn', guideId: 'G2', changeFrom: '赵岚（G5）', changeTo: '陈牧（G2）' },
  { id: 'T7-07', bookingId: 'B-2407', at: 570, kind: '路线调整', title: '压缩路线：取消现代艺术馆', detail: '为赶回安检延误时间，经带队老师同意，取消 H3，讲解时长由 45 分钟压缩至 30 分钟。', tag: 'warn', changeFrom: 'H2→H1→H3（45 分钟）', changeTo: 'H2→H1（30 分钟）' },
  { id: 'T7-08', bookingId: 'B-2407', at: 600, kind: '设备事故', title: '归还发现 1 台耳麦损坏', detail: 'M-1007 耳罩脱落、线材断裂，按 ¥50 计维修费；其余 19 台完好。', tag: 'bad', changeFrom: '发出 20 台', changeTo: '完好 19 · 损坏 1' },
  { id: 'T7-09', bookingId: 'B-2407', at: 601, kind: '归还设备', title: '耳麦归还与押金结算', detail: '押金 ¥4,000，扣除维修费 ¥50，退还 ¥3,950。', tag: 'ok', changeFrom: '押金 ¥4,000', changeTo: '退还 ¥3,950' },
  { id: 'T7-10', bookingId: 'B-2407', at: 601, kind: '离馆结算', title: '离馆 · 满意度 3/5', detail: '带队老师评价：展品好但赶、等候久。', tag: 'warn', changeTo: '满意度 3/5' },
  { id: 'T7-11', bookingId: 'B-2407', at: 630, kind: '投诉登记', title: '投诉：讲解缩水 + 等待过长', detail: '旅行社（代家长）投诉实际讲解仅 30 分钟、少看一个展厅，且安检等待 25 分钟。待运营主管处理。', tag: 'bad' }
]

export const bookings: Booking[] = [
  {
    id: 'B-2401',
    orgType: '学校',
    orgName: '阳光小学',
    contactName: '周敏（年级组长）',
    contactPhone: '138-0000-2401',
    size: 44,
    ageLayers: { ...emptyAgeLayers(), 儿童: 30, 成人: 14 },
    lang: '中文',
    accessible: false,
    theme: '亲子探秘',
    arriveAt: 570,
    busCount: 2,
    dockSpot: 'D3·南门大巴3位',
    needHeadsets: true,
    headsetNeeded: 30,
    note: '三年级亲子团，含 2 名校医与家长志愿者；儿童需佩戴黄标接收器。',
    status: '讲解中',
    createdAt: 552,
    confirmedAt: 560,
    guideId: 'G3',
    batchStart: 580,
    lane: '团队通道A',
    plannedDuration: 70,
    actualArrive: 575,
    actualSize: { adults: 16, children: 30, total: 46 },
    securityNote: '雨天晚到 5 分钟，安检 1 分钟通过。',
    headsets: hs(30, '已发'),
    depositPer: 200,
    depositTotal: 6000,
    enteredAt: 580,
    route: route2401
  },
  {
    id: 'B-2402',
    orgType: '企业',
    orgName: '华远科技',
    contactName: 'Richard Li（行政）',
    contactPhone: '139-0000-2402',
    size: 28,
    ageLayers: { ...emptyAgeLayers(), 成人: 27, 长者: 1 },
    lang: '英文',
    accessible: true,
    theme: '常设精选',
    arriveAt: 600,
    busCount: 1,
    dockSpot: 'D5·地下中巴位',
    needHeadsets: true,
    headsetNeeded: 28,
    note: '外籍访客考察团，1 位轮椅访客，需全程无障碍坡道与电梯。',
    status: '已到馆',
    createdAt: 570,
    confirmedAt: 575,
    guideId: 'G1',
    batchStart: 645,
    lane: '团队通道B',
    plannedDuration: 90,
    actualArrive: 605,
    actualSize: { adults: 28, children: 0, total: 28 },
    securityNote: '通道A 饱和后改 B；受 B-2401 延误影响批次顺延至 10:45。',
    headsets: hs(28, '已发'),
    depositPer: 200,
    depositTotal: 5600,
    route: [
      { hallId: 'H1', plannedEnter: 645, plannedDuration: 20, state: '计划', note: '入场时若 H1 仍拥堵，建议先改 H2' },
      { hallId: 'H2', plannedEnter: 668, plannedDuration: 18, state: '计划' },
      { hallId: 'H3', plannedEnter: 689, plannedDuration: 22, state: '计划' }
    ]
  },
  {
    id: 'B-2403',
    orgType: '旅行社',
    orgName: '远山旅行社',
    contactName: '马涛（领队）',
    contactPhone: '137-0000-2403',
    size: 56,
    ageLayers: { ...emptyAgeLayers(), 成人: 44, 长者: 12 },
    lang: '中文',
    accessible: true,
    theme: '特展专题',
    arriveAt: 630,
    busCount: 3,
    dockSpot: 'D1·南门大巴1位',
    needHeadsets: true,
    headsetNeeded: 50,
    note: '“银发看展”专线，12 位 65 岁以上长者，2 位需拐杖；要求慢节奏、多休息。',
    status: '待确认',
    createdAt: 628,
    headsets: [],
    depositPer: 200,
    route: []
  },
  {
    id: 'B-2404',
    orgType: '学校',
    orgName: '晨星幼儿园',
    contactName: '林老师',
    contactPhone: '136-0000-2404',
    size: 32,
    ageLayers: { ...emptyAgeLayers(), 幼儿: 24, 成人: 8 },
    lang: '中文',
    accessible: false,
    theme: '亲子探秘',
    arriveAt: 660,
    busCount: 1,
    dockSpot: 'D4·东门旅游车位',
    needHeadsets: true,
    headsetNeeded: 20,
    note: '中大班亲子活动，幼儿 24 名 + 家长 8 名，需避开安静展厅与楼梯区域。',
    status: '待确认',
    createdAt: 636,
    headsets: [],
    depositPer: 200,
    route: []
  },
  {
    id: 'B-2405',
    orgType: '企业',
    orgName: '恒信银行',
    contactName: '郑昊（工会）',
    contactPhone: '135-0000-2405',
    size: 22,
    ageLayers: { ...emptyAgeLayers(), 成人: 22 },
    lang: '中文',
    accessible: false,
    theme: '快速通览',
    arriveAt: 810,
    busCount: 0,
    dockSpot: '无（地铁集合）',
    needHeadsets: false,
    headsetNeeded: 0,
    note: '午间团建，不借用耳麦，要求 14:30 前结束。',
    status: '待确认',
    createdAt: 650,
    headsets: [],
    depositPer: 200,
    route: []
  },
  {
    id: 'B-2406',
    orgType: '旅行社',
    orgName: '樱之会国际旅行社',
    contactName: '佐藤健',
    contactPhone: '+81-90-2406',
    size: 18,
    ageLayers: { ...emptyAgeLayers(), 成人: 16, 长者: 2 },
    lang: '日文',
    accessible: false,
    theme: '常设精选',
    arriveAt: 840,
    busCount: 1,
    dockSpot: 'D2·南门大巴2位',
    needHeadsets: true,
    headsetNeeded: 18,
    note: '日本关西方游客团，需日文讲解，偏好书法与佛教美术。',
    status: '待确认',
    createdAt: 655,
    headsets: [],
    depositPer: 200,
    route: []
  },
  {
    id: 'B-2407',
    orgType: '学校',
    orgName: '博研教育',
    contactName: '高岩（研学导师）',
    contactPhone: '133-0000-2407',
    size: 36,
    ageLayers: { ...emptyAgeLayers(), 青少年: 34, 成人: 2 },
    lang: '中文',
    accessible: false,
    theme: '快速通览',
    arriveAt: 540,
    busCount: 2,
    dockSpot: 'D1·南门大巴1位',
    needHeadsets: true,
    headsetNeeded: 20,
    note: '初中生研学半日营。',
    status: '已离馆',
    createdAt: 520,
    confirmedAt: 528,
    guideId: 'G2',
    batchStart: 570,
    lane: '团队通道A',
    plannedDuration: 45,
    rejectReason: undefined,
    actualArrive: 540,
    actualSize: { adults: 2, children: 34, total: 36 },
    securityNote: '早高峰通道A 等待 25 分钟。',
    headsets: [
      ...hs(19, '已还').map((u, i) => ({ ...u, code: `M-${2000 + i}` })),
      { code: 'M-1007', state: '损坏' as const, issue: '耳罩脱落、线材断裂，维修费 ¥50' }
    ],
    depositPer: 200,
    depositTotal: 4000,
    enteredAt: 570,
    route: [
      { hallId: 'H2', plannedEnter: 545, plannedDuration: 15, actualEnter: 570, actualLeave: 585, state: '已完成' },
      { hallId: 'H1', plannedEnter: 560, plannedDuration: 15, actualEnter: 586, actualLeave: 600, state: '已完成' },
      { hallId: 'H3', plannedEnter: 575, plannedDuration: 15, state: '已跳过', note: '压缩路线，经带队老师同意取消' }
    ],
    actualLeave: 601,
    satisfaction: 3,
    complaint: {
      type: '讲解缩水',
      detail: '实际讲解仅 30 分钟、现代艺术馆被取消；安检等待 25 分钟无人引导。',
      at: 630,
      resolved: false
    }
  },
  done({
    id: 'B-2397', orgType: '学校', orgName: '市第三中学', contactName: '吴老师', contactPhone: '138-0000-2397',
    size: 48, ageLayers: { ...emptyAgeLayers(), 青少年: 42, 成人: 6 }, lang: '中文', accessible: false, theme: '亲子探秘',
    arrive: 540, dockSpot: 'D2·南门大巴2位', busCount: 2, needHeadsets: true, headsetNeeded: 30,
    guideId: 'G3', entered: 548, leave: 625, planned: 80, sat: 5, issue: ''
  }),
  done({
    id: 'B-2398', orgType: '企业', orgName: '明德会计师事务所', contactName: '何静', contactPhone: '139-0000-2398',
    size: 20, ageLayers: { ...emptyAgeLayers(), 成人: 20 }, lang: '中文', accessible: false, theme: '快速通览',
    arrive: 550, dockSpot: '无（地铁集合）', busCount: 0, needHeadsets: false, headsetNeeded: 0,
    guideId: 'G5', entered: 560, leave: 615, planned: 50, sat: 4, issue: ''
  }),
  done({
    id: 'B-2399', orgType: '旅行社', orgName: '金色夕阳旅行社', contactName: '孙姐', contactPhone: '137-0000-2399',
    size: 42, ageLayers: { ...emptyAgeLayers(), 成人: 14, 长者: 28 }, lang: '中文', accessible: true, theme: '常设精选',
    arrive: 560, dockSpot: 'D4·东门旅游车位', busCount: 2, needHeadsets: true, headsetNeeded: 30,
    guideId: 'G2', entered: 561, leave: 641, planned: 85, sat: 4, issue: '1 台耳麦听筒无声（损坏），维修费 ¥50'
  }),
  done({
    id: 'B-2400', orgType: '企业', orgName: 'Apollo Trading', contactName: 'Helen Zhou', contactPhone: '135-0000-2400',
    size: 16, ageLayers: { ...emptyAgeLayers(), 成人: 16 }, lang: '英文', accessible: false, theme: '常设精选',
    arrive: 570, dockSpot: 'D5·地下中巴位', busCount: 1, needHeadsets: true, headsetNeeded: 16,
    guideId: 'G1', entered: 602, leave: 635, planned: 55, sat: 2, issue: '',
    complaint: { type: '等待过长', detail: '安检等待 32 分钟，讲解被动压缩，行程延误。', at: 640, resolved: true, handleNote: '已致歉并赠送特展夜场名额；早高峰增开通道B 团队口。' }
  })
]

export const timeline: TimelineEvent[] = [...events2401, ...events2402, ...events2407]
