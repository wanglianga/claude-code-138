import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    {
      path: '/overview',
      name: 'overview',
      component: () => import('@/views/OverviewView.vue'),
      meta: { title: '运营总览', icon: '览' }
    },
    {
      path: '/bookings',
      name: 'bookings',
      component: () => import('@/views/BookingsView.vue'),
      meta: { title: '团体预约', icon: '约' }
    },
    {
      path: '/bookings/new',
      name: 'new-booking',
      component: () => import('@/views/NewBookingView.vue'),
      meta: { title: '新建团体预约', icon: '报' }
    },
    {
      path: '/bookings/:id',
      name: 'booking-detail',
      component: () => import('@/views/BookingDetailView.vue'),
      props: true,
      meta: { title: '预约调度详情', icon: '约' }
    },
    {
      path: '/dispatch',
      name: 'dispatch',
      component: () => import('@/views/DispatchView.vue'),
      meta: { title: '展厅分流台', icon: '流' }
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/views/AnalyticsView.vue'),
      meta: { title: '复盘与优化', icon: '析' }
    }
  ]
})
