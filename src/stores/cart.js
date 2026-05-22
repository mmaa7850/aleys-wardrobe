import { defineStore } from 'pinia'
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

export const useCartStore = defineStore('cart', {
  state: () => ({
    cartId: null,
    memberDbId: null,
    items: [],
    isLoading: false,
    selectedItemIds: [],
  }),

  getters: {
    itemCount: (state) => state.items.reduce((sum, item) => sum + item.qty, 0),
    total: (state) => state.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    isEmpty: (state) => state.items.length === 0,
    selectedItems: (state) => state.items.filter(i => state.selectedItemIds.includes(i.id)),
    selectedTotal: (state) => state.items
      .filter(i => state.selectedItemIds.includes(i.id))
      .reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
  },

  actions: {
    async resolveMemberDbId() {
      if (this.memberDbId) return this.memberDbId

      const auth = useAuthStore()
      if (!auth.isLoggedIn) throw new Error('Not logged in')

      const userId = auth.user.id

      // Look up existing member
      const { data: existing, error: lookupErr } = await db
        .from('C_MBR_MemberList')
        .select('ID')
        .eq('UserID', userId)
        .maybeSingle()

      if (lookupErr) throw lookupErr

      if (existing) {
        this.memberDbId = existing.ID
        return this.memberDbId
      }

      // Auto-create member record
      const auth2 = useAuthStore()
      const email = auth2.user?.email || ''
      const { data: created, error: createErr } = await db
        .from('C_MBR_MemberList')
        .insert({ UserID: userId, Email: email, IsActive: true })
        .select('ID')
        .single()

      if (createErr) throw createErr

      this.memberDbId = created.ID
      return this.memberDbId
    },

    async fetchCart() {
      this.isLoading = true
      try {
        const memberId = await this.resolveMemberDbId()

        // Get or create cart
        const { data: existing, error: cartErr } = await db
          .from('C_CART_CartList')
          .select('ID')
          .eq('MemberID', memberId)
          .maybeSingle()

        if (cartErr) throw cartErr

        if (existing) {
          this.cartId = existing.ID
        } else {
          const { data: created, error: createErr } = await db
            .from('C_CART_CartList')
            .insert({ MemberID: memberId })
            .select('ID')
            .single()
          if (createErr) throw createErr
          this.cartId = created.ID
        }

        await this._loadItems()
      } catch (err) {
        console.error('[cart] fetchCart error:', err)
      } finally {
        this.isLoading = false
      }
    },

    async _loadItems() {
      if (!this.cartId) return

      // Fetch raw cart items
      const { data: rawItems, error } = await db
        .from('C_CART_CartItemList')
        .select('ID, ProductID, VariantID, Qty')
        .eq('CartID', this.cartId)

      if (error) throw error
      if (!rawItems || rawItems.length === 0) {
        this.items = []
        return
      }

      const productIds = [...new Set(rawItems.map(i => i.ProductID))]
      const variantIds = [...new Set(rawItems.map(i => i.VariantID))]

      // Parallel fetches
      const [
        { data: products },
        { data: variants },
      ] = await Promise.all([
        db.from('C_PRD_ProductList')
          .select('ID, ProductName, Price, IsPreOrder, PreOrderShipDate, C_PRD_ProductPictureList(StoragePath, IsMain, Type)')
          .in('ID', productIds),
        db.from('C_PRD_ProductVariantList')
          .select('ID, ColorID, SizeID, StockQty')
          .in('ID', variantIds),
      ])

      // Get unique color/size IDs
      const colorIds = [...new Set((variants || []).map(v => v.ColorID).filter(Boolean))]
      const sizeIds = [...new Set((variants || []).map(v => v.SizeID).filter(Boolean))]

      const [
        { data: colors },
        { data: sizes },
      ] = await Promise.all([
        colorIds.length
          ? db.from('S_PRD_ColorList').select('ID, Name').in('ID', colorIds)
          : Promise.resolve({ data: [] }),
        sizeIds.length
          ? db.from('S_PRD_SizeList').select('ID, Name').in('ID', sizeIds)
          : Promise.resolve({ data: [] }),
      ])

      // Build lookup maps
      const productMap = Object.fromEntries((products || []).map(p => [p.ID, p]))
      const variantMap = Object.fromEntries((variants || []).map(v => [v.ID, v]))
      const colorMap = Object.fromEntries((colors || []).map(c => [c.ID, c.Name]))
      const sizeMap = Object.fromEntries((sizes || []).map(s => [s.ID, s.Name]))

      function getThumb(product) {
        const pics = product?.C_PRD_ProductPictureList || []
        // 主圖優先，不管類型；都沒主圖才取第一張
        const thumb = pics.find(p => p.IsMain) || pics[0] || null
        if (!thumb) return null
        return {
          url: supabase.storage.from('product-pictures').getPublicUrl(thumb.StoragePath).data?.publicUrl || null,
          type: thumb.Type || 'image',
        }
      }

      this.items = rawItems.map(item => {
        const product = productMap[item.ProductID] || {}
        const variant = variantMap[item.VariantID] || {}
        const media = getThumb(product)

        return {
          id: item.ID,
          productId: item.ProductID,
          variantId: item.VariantID,
          qty: item.Qty,
          productName: product.ProductName || '',
          unitPrice: product.Price || 0,
          colorName: colorMap[variant.ColorID] || '',
          sizeName: sizeMap[variant.SizeID] || '',
          stockQty: variant.StockQty ?? 0,
          isPreOrder: !!(product.IsPreOrder) && (variant.StockQty ?? 0) <= 0,
          preOrderShipDate: product.PreOrderShipDate || null,
          imgUrl: media?.url || null,
          imgType: media?.type || 'image',
        }
      })
    },

    async addItem(productId, variantId, qty = 1) {
      if (!this.cartId) await this.fetchCart()

      const existing = this.items.find(i => i.variantId === variantId)
      if (existing) {
        await this.updateQty(existing.id, existing.qty + qty)
        return
      }

      // 判斷是否為預購商品（StockQty <= 0 = 預購，不需扣庫存）
      const { data: variantData } = await db
        .from('C_PRD_ProductVariantList')
        .select('StockQty')
        .eq('ID', variantId)
        .single()

      const isPreOrder = (variantData?.StockQty ?? 0) <= 0

      // 非預購：原子性扣庫存
      if (!isPreOrder) {
        const { data: ok, error: rpcErr } = await db.rpc('decrement_stock', { p_variant_id: variantId, p_qty: qty })
        if (rpcErr) throw rpcErr
        if (!ok) throw new Error('庫存不足，無法加入購物車')
      }

      const { error } = await db
        .from('C_CART_CartItemList')
        .insert({ CartID: this.cartId, ProductID: productId, VariantID: variantId, Qty: qty })
        .select('ID')
        .single()

      if (error) {
        // DB 寫入失敗，回補庫存
        if (!isPreOrder) await db.rpc('restore_stock', { p_variant_id: variantId, p_qty: qty })
        throw error
      }

      await this._loadItems()
    },

    async updateQty(itemId, qty) {
      if (qty < 1) {
        await this.removeItem(itemId)
        return
      }

      const item = this.items.find(i => i.id === itemId)

      // 非預購：處理庫存差量
      if (item && !item.isPreOrder) {
        const delta = qty - item.qty
        if (delta > 0) {
          // 增加數量：再扣庫存
          const { data: ok, error: rpcErr } = await db.rpc('decrement_stock', { p_variant_id: item.variantId, p_qty: delta })
          if (rpcErr) throw rpcErr
          if (!ok) throw new Error('庫存不足')
        } else if (delta < 0) {
          // 減少數量：回補庫存
          await db.rpc('restore_stock', { p_variant_id: item.variantId, p_qty: -delta })
        }
      }

      const { error } = await db
        .from('C_CART_CartItemList')
        .update({ Qty: qty })
        .eq('ID', itemId)

      if (error) throw error

      if (item) item.qty = qty
    },

    async removeItem(itemId) {
      const { error } = await db
        .from('C_CART_CartItemList')
        .delete()
        .eq('ID', itemId)

      if (error) throw error

      this.items = this.items.filter(i => i.id !== itemId)
    },

    async clearCart() {
      if (!this.cartId) return

      const { error } = await db
        .from('C_CART_CartItemList')
        .delete()
        .eq('CartID', this.cartId)

      if (error) throw error

      this.items = []
    },

    initSelection() {
      // 非預購商品永遠選取（已扣庫存），預購商品預設也全選但可取消
      this.selectedItemIds = this.items.map(i => i.id)
    },

    toggleSelection(id) {
      // 只允許預購商品切換選取狀態
      const item = this.items.find(i => i.id === id)
      if (!item || !item.isPreOrder) return
      const idx = this.selectedItemIds.indexOf(id)
      if (idx >= 0) this.selectedItemIds.splice(idx, 1)
      else this.selectedItemIds.push(id)
    },

    reset() {
      this.cartId = null
      this.memberDbId = null
      this.items = []
      this.isLoading = false
      this.selectedItemIds = []
    },
  },
})
