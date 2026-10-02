<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMuseumStore } from '@/stores/museum'
import { m2hm, todayLabel } from '@/utils/time'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const store = useMuseumStore()
const { list } = useToast()

const nav = computed(() =>
  [
    { to: '/overview', label: '运营总览', ico: '览' },
    { to: '/bookings', label: '团体预约', ico: '约' },
    { to: '/dispatch', label: '展厅分流台', ico: '流' },
    { to: '/analytics', label: '复盘与优化', ico: '析' }
  ].map((n) => ({ ...n, active: route.path === n.to || (n.to === '/bookings' && route.path.startsWith('/bookings')) }))
)

const activeKey = computed(() => (route.name === 'new-booking' ? '新建团体预约' : (route.meta.title as string) ?? ''))
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-seal">美</div>
        <div>
          <div class="brand-name">云澜美术馆</div>
          <div class="brand-sub">团体参观调度台 v1.0</div>
        </div>
      </div>
      <router-link v-for="n in nav" :key="n.to" :to="n.to" class="nav-item" :class="{ active: n.active }">
        <span class="nav-ico">{{ n.ico }}</span>
        {{ n.label }}
      </router-link>
      <div class="sidebar-foot">
        {{ todayLabel() }} 运营中<br />
        开馆 09:00 · 闭馆 17:00<br />
        演示数据可在页面内操作
      </div>
    </aside>

    <main class="main">
      <header class="page-head">
        <div>
          <h1 class="page-title">{{ activeKey }}</h1>
          <div class="page-sub">
            团体预约 · 讲解设备借还 · 展厅分流调度 —— 兼顾馆内安静观展与团队体验
          </div>
        </div>
        <div class="clock">
          <b>{{ m2hm(store.now) }}</b>
          当前时刻 · 馆内团队访客 {{ store.inMuseumVisitors }} 人<br />
          待确认预约 {{ store.pending.length }} 单 · 未结投诉 {{ store.openComplaints.length }} 件
        </div>
      </header>
      <router-view />
    </main>

    <div class="toast-wrap">
      <div v-for="t in list" :key="t.id" class="toast">{{ t.text }}</div>
    </div>
  </div>
</template>
