/** 全局运营常量 */
export const OPEN_MIN = 9 * 60 // 09:00 开馆
export const CLOSE_MIN = 17 * 60 // 17:00 闭馆
export const HEADSET_STOCK = 120
export const DEPOSIT_PER = 200 // 每台耳麦押金（元）
export const HEADSET_PRICE = 300 // 遗失赔偿单价
export const DAMAGE_FEE = 50 // 单台损坏清洁/维修费

/** 模拟“当前时刻”（分钟）。演示用固定时钟：10:42 */
export const NOW_MIN = 10 * 60 + 42

/** 大团阈值：达到此人数需拆批入场 */
export const BIG_GROUP = 40
/** 单批建议上限（安检 + 展厅体验） */
export const BATCH_LIMIT = 30
/** 拥堵阈值：厅内人数达到容量 85% 判定拥堵 */
export const CROWD_RATIO = 0.85
/** 安静展厅团队错峰阈值更低 */
export const QUIET_CROWD_RATIO = 0.7
/** 入场时隙（分钟） */
export const ENTRY_SLOT = 15
