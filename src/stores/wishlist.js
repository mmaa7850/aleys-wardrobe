import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { useCartStore } from '@/stores/cart'

export const useWishlistStore = defineStore('wishlist', {
  state: () => ({
    productIds: [],
  }),

  getters: {
    has: (state) => (id) => state.productIds.includes(Number(id)),
    count: (state) => state.productIds.length,
  },

  actions: {
    async fetch() {
      const cartStore = useCartStore()
      const memberId = await cartStore.resolveMemberDbId()

      const { data, error } = await db
        .from('C_MBR_WishList')
        .select('ProductID')
        .eq('MemberID', memberId)

      if (error) {
        console.error('[wishlist] fetch error:', error)
        return
      }

      this.productIds = (data || []).map(row => Number(row.ProductID))
    },

    async toggle(productId) {
      const cartStore = useCartStore()
      const memberId = await cartStore.resolveMemberDbId()
      const pid = Number(productId)

      if (this.productIds.includes(pid)) {
        // Remove
        const { error } = await db
          .from('C_MBR_WishList')
          .delete()
          .eq('MemberID', memberId)
          .eq('ProductID', pid)

        if (error) throw error

        this.productIds = this.productIds.filter(id => id !== pid)
        return false
      } else {
        // Add
        const { error } = await db
          .from('C_MBR_WishList')
          .insert({ MemberID: memberId, ProductID: pid })

        if (error) throw error

        this.productIds.push(pid)
        return true
      }
    },

    reset() {
      this.productIds = []
    },
  },
})
