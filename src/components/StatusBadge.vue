<script setup lang="ts">
import { STATUS_LABEL, type ReservationStatus } from '@/types'

defineProps<{ status: ReservationStatus }>()
</script>

<template>
  <span class="badge" :class="`badge-${status}`">{{ STATUS_LABEL[status] }}</span>
</template>
