import { defineStore } from 'pinia'

export type Role = 'staff' | 'visitor'

interface SessionState {
  role: Role
  staffName: string
}

export const useSessionStore = defineStore('session', {
  state: (): SessionState => ({
    role: 'staff',
    staffName: '前台主管 沈姐',
  }),
  actions: {
    setRole(role: Role) {
      this.role = role
    },
    setStaffName(name: string) {
      this.staffName = name
    },
  },
  persist: { key: 'museum-session' },
})
