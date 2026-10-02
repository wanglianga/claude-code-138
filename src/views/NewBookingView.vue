<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import { AGE_LAYERS, LANGS, ORG_TYPES, THEMES } from '@/types'
import type { AgeLayer, Lang, OrgType, ThemeId } from '@/types'
import { emptyAgeLayers } from '@/data/seed'
import { hm2m, m2hm } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const store = useMuseumStore()
const { toast } = useToast()

const form = reactive({
  orgType: '学校' as OrgType,
  orgName: '',
  contactName: '',
  contactPhone: '',
  ageLayers: emptyAgeLayers(),
  lang: '中文' as Lang,
  accessible: false,
  theme: '常设精选' as ThemeId,
  arriveHM: '10:30',
  busCount: 1,
  dockSpot: store.spots[0],
  needHeadsets: true,
  headsetNeeded: 20,
  note: ''
})

const formSize = ref(20)
const ageSum = computed(() => AGE_LAYERS.reduce((n, k) => n + (form.ageLayers[k] || 0), 0))
const sizeMismatch = computed(() => ageSum.value > 0 && ageSum.value !== formSize.value)

const slots: string[] = []
for (let m = 9 * 60; m <= 16 * 60; m += 15) slots.push(m2hm(m))

const sameSlotTeams = computed(() => {
  const at = hm2m(form.arriveHM)
  return store.bookingList.filter(
    (b) => !['已驳回', '已取消', '已离馆'].includes(b.status) && Math.abs(b.arriveAt - at) <= 15
  )
})

const errs = computed(() => {
  const e: string[] = []
  if (!form.orgName.trim()) e.push('请填写学校 / 企业 / 旅行社名称')
  if (!form.contactName.trim()) e.push('请填写联系人')
  if (!/[\d-]{7,}/.test(form.contactPhone.trim())) e.push('请填写有效联系电话')
  if (formSize.value < 5) e.push('团体人数不少于 5 人')
  if (ageSum.value > 0 && sizeMismatch.value) e.push('年龄层人数合计与团体总人数不一致')
  if (form.needHeadsets && form.headsetNeeded < 1) e.push('借用耳麦数量至少为 1')
  if (form.needHeadsets && form.headsetNeeded > store.headsetAvailable)
    e.push(`耳麦库存不足：当前可借 ${store.headsetAvailable} 台`)
  return e
})

function submit() {
  if (errs.value.length) {
    toast(errs.value[0])
    return
  }
  const id = store.createBooking({
    orgType: form.orgType,
    orgName: form.orgName.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    size: formSize.value,
    ageLayers: { ...form.ageLayers },
    lang: form.lang,
    accessible: form.accessible,
    theme: form.theme,
    arriveAt: hm2m(form.arriveHM),
    busCount: form.busCount,
    dockSpot: form.busCount > 0 ? form.dockSpot : '无（地铁集合）',
    needHeadsets: form.needHeadsets,
    headsetNeeded: form.needHeadsets ? form.headsetNeeded : 0,
    note: form.note.trim()
  })
  toast('预约已提交，进入工作人员校核')
  router.push(`/bookings/${id}`)
}

Object.defineProperty(form, 'size', { value: 0, writable: true, configurable: true })
const ageLabel: Record<AgeLayer, string> = { 幼儿: '3-6岁', 儿童: '7-12岁', 青少年: '13-17岁', 成人: '成人', 长者: '65岁+' }
</script>

<template>
  <div class="grid cols-2">
    <section class="card card-pad">
      <h2 class="card-title mb14">团体参观预约信息</h2>

      <div class="inline-fields">
        <div class="field">
          <label class="req">团体类型</label>
          <select v-model="form.orgType" class="select">
            <option v-for="t in ORG_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="field">
          <label class="req">学校 / 企业 / 旅行社名称</label>
          <input v-model="form.orgName" class="input" placeholder="如：阳光小学" />
        </div>
      </div>

      <div class="inline-fields">
        <div class="field">
          <label class="req">联系人</label>
          <input v-model="form.contactName" class="input" placeholder="姓名 / 职务" />
        </div>
        <div class="field">
          <label class="req">联系电话</label>
          <input v-model="form.contactPhone" class="input" placeholder="手机号或带国别码电话" />
        </div>
      </div>

      <div class="inline-fields">
        <div class="field">
          <label class="req">团体总人数</label>
          <input v-model.number="formSize" type="number" min="5" max="120" class="input" />
        </div>
        <div class="field">
          <label>年龄层分布（用于儿童路线/长者节奏）</label>
          <div class="age-grid">
            <div v-for="k in AGE_LAYERS" :key="k" class="age-cell">
              <span>{{ k }}<br /><i class="muted">{{ ageLabel[k] }}</i></span>
              <input v-model.number="form.ageLayers[k]" type="number" min="0" class="input" />
            </div>
          </div>
          <div class="small" :style="sizeMismatch ? 'color:var(--bad-fg)' : 'color:var(--ink-3)'">
            年龄层合计 {{ ageSum }} 人{{ sizeMismatch ? '，与总人数不一致' : '' }}
          </div>
        </div>
      </div>

      <div class="inline-fields">
        <div class="field">
          <label class="req">讲解语言</label>
          <select v-model="form.lang" class="select">
            <option v-for="l in LANGS" :key="l" :value="l">{{ l }}</option>
          </select>
        </div>
        <div class="field">
          <label class="req">讲解主题</label>
          <select v-model="form.theme" class="select">
            <option v-for="t in THEMES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
      </div>

      <div class="inline-fields">
        <div class="field">
          <label class="req">计划到馆时间</label>
          <select v-model="form.arriveHM" class="select">
            <option v-for="s in slots" :key="s" :value="s">{{ s }}（15 分钟时隙）</option>
          </select>
        </div>
        <div class="field">
          <label>随行车辆 / 停靠位</label>
          <div class="flex">
            <input v-model.number="form.busCount" type="number" min="0" max="6" class="input" style="width: 90px" />
            <select v-if="form.busCount > 0" v-model="form.dockSpot" class="select">
              <option v-for="s in store.spots" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="field">
        <label class="switch">
          <input type="checkbox" v-model="form.accessible" />
          需要无障碍路线（轮椅 / 拐杖 / 婴儿车，全程坡道电梯，避开阁楼 H6）
        </label>
      </div>

      <div class="field">
        <label class="switch">
          <input type="checkbox" v-model="form.needHeadsets" />
          借用讲解耳麦
        </label>
        <div v-if="form.needHeadsets" class="flex mt" style="margin-top: 8px">
          <input v-model.number="form.headsetNeeded" type="number" min="1" max="120" class="input" style="width: 120px" />
          <span class="small muted">台 · 押金 ¥200/台 · 当前可借 {{ store.headsetAvailable }} 台</span>
        </div>
      </div>

      <div class="field">
        <label>特殊需求备注</label>
        <textarea v-model="form.note" class="textarea" placeholder="如：含 2 名校医、儿童需黄标接收器、长者需慢节奏多休息等"></textarea>
      </div>

      <div class="flex">
        <button class="btn btn-primary" @click="submit">提交预约，送工作人员确认</button>
        <button class="btn" @click="router.back()">取消</button>
      </div>
    </section>

    <section class="grid" style="grid-template-rows: auto 1fr">
      <div class="card card-pad">
        <h2 class="card-title mb14">提交前自检</h2>
        <div v-if="errs.length" class="alert-list">
          <div v-for="(e, i) in errs" :key="i" class="alert alert-block">✕ {{ e }}</div>
        </div>
        <div v-else class="alert alert-ok">✓ 信息完整：提交后由工作人员依据展厅容量、热门展品、讲解员排班、安检通道与临时闭展安排确认。</div>
        <div v-if="sameSlotTeams.length" class="alert alert-warn mt14">
          ⚠ 同一到馆时段（±15 分钟）已有 {{ sameSlotTeams.length }} 个团队：{{ sameSlotTeams.map((b) => `${b.orgName}${b.size}人`).join('、') }}，确认时将校核安检通道与拆批。
        </div>
      </div>
      <div class="card card-pad">
        <h2 class="card-title mb14">主题路线与展厅提示（供预约方参考）</h2>
        <ul style="margin: 0; padding-left: 18px; color: var(--ink-2); font-size: 13px; line-height: 2">
          <li><b>亲子探秘</b>：互动探索厅 → 雕塑庭院，拓印/拼图互动，适合儿童。</li>
          <li><b>常设精选</b>：历代书画 → 雕塑庭院 → 现代艺术，含多件禁拍名品。</li>
          <li><b>特展专题</b>：浮世绘特展（部分时段轮换闭展）→ 书画 → 现代艺术。</li>
          <li>安静展区（书画/特展/陶瓷）团队错峰阈值更低，请跟随讲解员分组轻声观展。</li>
          <li>陶瓷珍品阁位于三层阁楼、仅楼梯可达，无障碍团自动避开。</li>
        </ul>
      </div>
    </section>
  </div>
</template>
