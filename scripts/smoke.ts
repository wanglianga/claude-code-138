import { createPinia, setActivePinia } from 'pinia'
import { useMuseumStore } from '@/stores/museum'
import { m2hm } from '@/utils/time'

let pass = 0
let fail = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    pass++
    console.log(`  ✓ ${msg}`)
  } else {
    fail++
    console.error(`  ✕ ${msg}`)
  }
}

setActivePinia(createPinia())
const s = useMuseumStore()

console.log('① 初始数据')
assert(s.bookingList.length === 11, `共 11 个预约（实际 ${s.bookingList.length}）`)
assert(s.pending.length === 4, `4 个待确认（实际 ${s.pending.length}）`)
assert(s.openComplaints.length === 1, `1 件未结投诉（实际 ${s.openComplaints.length}）`)
assert(s.headsetAvailable === 62, `耳麦可借 62 台（30+28 已发，实际 ${s.headsetAvailable}）`)
assert(s.crowdOf('H1').label === '拥堵', `H1 当前拥堵（实际 ${s.crowdOf('H1').label} ${s.crowdOf('H1').occ}/60）`)

console.log('② 大团无障碍确认（B-2403 远山旅行社 56 人）')
{
  const b = s.getBooking('B-2403')!
  const plan = s.suggestPlan(b)
  assert(plan.lane === '无障碍优先通道', '无障碍团默认无障碍通道')
  assert(!plan.route.some((x) => x.hallId === 'H6'), '路线自动排除仅楼梯可达的 H6 陶瓷阁')
  assert(s.evaluate(b, plan).filter((i) => i.level === 'block').length === 0, '确认校核无阻断项')
  s.confirm('B-2403', plan)
  const after = s.getBooking('B-2403')!
  assert(after.status === '已确认', '状态变为已确认')
  assert(after.batches?.length === 2 && after.batches[0].size === 30 && after.batches[1].size === 26, `56 人拆 2 批 30+26（实际 ${after.batches?.map((x) => x.size).join('+')}）`)
}

console.log('③ 日文团讲解员匹配（B-2406，14:00 到馆）')
{
  const b = s.getBooking('B-2406')!
  const plan = s.suggestPlan(b)
  assert(plan.guideId === 'G2', `日文团推荐陈牧 G2（实际 ${plan.guideId}）`)
  const g5 = s.guideList.find((g) => g.id === 'G5')!
  assert(!!s.guideAvailable(g5, plan.batchStart, plan.batchStart + plan.plannedDuration, b)?.includes('日文'), '不懂日文的志愿者不可排')
}

console.log('④ 已到馆团入场（B-2402 华远科技 28 人）')
{
  s.admit('B-2402')
  const b = s.getBooking('B-2402')!
  assert(b.status === '讲解中', '入场后状态为讲解中')
  assert(b.route[0].state === '参观中', '首个展厅进入参观中')
}

console.log('⑤ 讲解途中：完成展厅 → 拥堵改道（B-2401）')
{
  const before = s.getBooking('B-2401')!
  s.completeCurrent('B-2401') // 完成 H3
  assert(before.route.find((x) => x.hallId === 'H3')?.state === '已完成', 'H3 标记已完成')
  s.reroute('B-2401', ['H1', 'H5'], 'crowd')
  const after = s.getBooking('B-2401')!
  const remaining = after.route.filter((x) => x.state === '计划').map((x) => x.hallId)
  assert(remaining.join(',') === 'H1,H5', `剩余顺序 H1→H5（实际 ${remaining.join(',')}）`)
  assert(after.plannedDuration > 0, '讲解时长已重算：' + after.plannedDuration + ' 分钟')
  const ev = s.eventsOf('B-2401').filter((e) => e.kind === '拥堵分流').pop()
  assert(!!ev?.changeFrom && !!ev.changeTo && !!ev.capacitySnapshot, '分流事件保留决策前后与容量快照')
}

console.log('⑥ 展厅临时维护：受影响团队自动收到改道提示（H3 立即维护）')
{
  s.reportMaintenance('H3', s.now, s.now + 60, '设备维护')
  assert(s.hallById('H3')!.status === '维护', 'H3 状态变为维护')
  const b2402 = s.getBooking('B-2402')!
  const h3stop = b2402.route.find((x) => x.hallId === 'H3')
  assert(h3stop?.state === '拥堵改道', 'B-2402 计划中的 H3 被标记待改道')
  assert(s.eventsOf('B-2402').some((e) => e.kind === '展厅维护'), 'B-2402 时间线生成维护告警')
}

console.log('⑦ 设备事故与押金结算（B-2401 发 30 台）')
{
  s.markHeadset('B-2401', 'M-1002', '损坏', '耳罩脱落')
  s.markHeadset('B-2401', 'M-1006', '遗失', '清点未找到')
  const b = s.getBooking('B-2401')!
  const st = s.settlement(b)
  assert(st.damaged === 1 && st.lost === 1 && st.outstanding === 28, `1 损 1 失 28 未还（实际 ${st.damaged}/${st.lost}/${st.outstanding}）`)
  assert(st.damageFee === 50 && st.lostFee === 300 && st.refund === 6000 - 350, `押金应退 ¥5,650（实际 ¥${st.refund}）`)
  s.returnAllHeadsets('B-2401')
  const st2 = s.settlement(s.getBooking('B-2401')!)
  assert(st2.outstanding === 0, '批量归还后无未结设备')
}

console.log('⑧ 离馆结算与投诉溯源（B-2401）')
{
  s.checkout('B-2401', 4)
  const b = s.getBooking('B-2401')!
  assert(b.status === '已离馆' && b.satisfaction === 4, '离馆并记录满意度')
  s.addComplaint('B-2401', '讲解缩水', '测试投诉：等待过久')
  assert(s.openComplaints.length === 2, '未结投诉增至 2 件')
  s.resolveComplaint('B-2401', '测试处理：已致歉')
  assert(s.openComplaints.length === 1, '处理后未结投诉回到 1 件')
  const kinds = s.eventsOf('B-2401').map((e) => e.kind)
  for (const k of ['预约提交', '确认预约', '团体迟到', '入馆批次', '儿童走散', '拥堵分流', '设备事故', '归还设备', '离馆结算', '投诉登记', '投诉处理']) {
    assert(kinds.includes(k as never), `时间线包含「${k}」`)
  }
}

console.log('⑨ 新建预约（库存联动）')
{
  const id = s.createBooking({
    orgType: '企业', orgName: '测试科技有限公司', contactName: '张三', contactPhone: '13800001234',
    size: 10, ageLayers: { 幼儿: 0, 儿童: 0, 青少年: 0, 成人: 10, 长者: 0 },
    lang: '中文', accessible: false, theme: '快速通览', arriveAt: 720, busCount: 0, dockSpot: '无（地铁集合）',
    needHeadsets: false, headsetNeeded: 0, note: ''
  })
  assert(id.startsWith('B-24'), `新预约编号 ${id}`)
  assert(s.getBooking(id)?.status === '待确认', '新预约为待确认')
  assert(s.pending.length === 4, '确认 B-2403 后新建，待确认为 4 单（5-1-1+1）')
}

console.log(`⑩ 时间线全部记录含时间戳，当前时刻 ${m2hm(s.now)}`)
assert(s.events.every((e) => e.at >= 8 * 60 && e.at <= 18 * 60), '所有事件时间在当日 08:00–18:00 范围内')

console.log(`\n结果：${pass} 通过，${fail} 失败`)
if (fail) process.exit(1)
