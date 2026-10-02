import { reactive } from 'vue'

export interface Toast {
  id: number
  text: string
}

const list = reactive<Toast[]>([])
let seq = 0

export function toast(text: string, hold = 2600) {
  const id = ++seq
  list.push({ id, text })
  setTimeout(() => {
    const i = list.findIndex((t) => t.id === id)
    if (i >= 0) list.splice(i, 1)
  }, hold)
}

export function useToast() {
  return { list, toast }
}
