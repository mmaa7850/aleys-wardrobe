import { defineStore } from 'pinia'
import { db } from '@/lib/db'

export const useSiteConfigStore = defineStore('siteConfig', {
  state: () => ({
    config: {},
    loaded: false,
  }),

  getters: {
    get: (state) => (key) => state.config[key] ?? null,
    announcement: (state) => state.config['announcement'] || '',
    maintenanceMode: (state) => state.config['maintenance_mode'] === 'true',
    paymentDisabled: (state) => state.config['payment_disabled'] === 'true',
  },

  actions: {
    async load() {
      if (this.loaded) return
      const { data } = await db.from('S_SYS_Config').select('Name, Value')
      if (data) {
        this.config = Object.fromEntries(data.map((row) => [row.Name, row.Value]))
        this.loaded = true
      }
    },
  },
})
