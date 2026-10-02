<script setup lang="ts">
import type { BookingStatus } from '@/types'

const map: Record<BookingStatus, string> = {
  待确认: 'badge-warn',
  已确认: 'badge-neutral',
  已驳回: 'badge-bad',
  已到馆: 'badge-neutral',
  讲解中: 'badge-ok',
  已离馆: 'badge-outline',
  已取消: 'badge-outline'
}
defineProps<{ status: BookingStatus }>()
</script>

<template>
  <span class="badge" :class="map[status]">{{ status }}</span>
</template>
