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
    selectedItemIds: [],   // 保留相容舊邏輯
    checkoutType: null,    // 'stock' | 'preorder' | null
  }),

  getters: {
    itemCount: (state) => state.items.reduce((sum, item) => sum + item.qty, 0),
    total: (state) => state.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    isEmpty: (state) => state.items.length === 0,

    // 分組 getter
    stockItems:   (state) => state.items.filter(i => !i.isPreOrder && !i.isReward),
    preorderItems:(state) => state.items.filter(i => i.isPreOrder),
    rewardItems:  (state) => state.items.filter(i => i.isReward),
    stockTotal:   (state) => state.items.filter(i => !i.isPreOrder && !i.isReward).reduce((s, i) => s + i.unitPrice * i.qty, 0),
    preorderTotal:(state) => state.items.filter(i => i.isPreOrder).reduce((s, i) => s + i.unitPrice * i.qty, 0),

    // Checkout 依 type 決定品項（CheckoutView 使用）
    selectedItems: (state) => {
      if (state.checkoutType === 'stock')    return state.items.filter(i => !i.isPreOrder)  // 含購物金
      if (state.checkoutType === 'preorder') return state.items.filter(i => i.isPreOrder)
      return state.items.filter(i => state.selectedItemIds.includes(i.id))
    },
    selectedTotal: (state) => {
      if (state.checkoutType === 'stock')    return state.items.filter(i => !i.isPreOrder).reduce((s, i) => s + i.unitPrice * i.qty, 0)
      if (state.checkoutType === 'preorder') return state.items.filter(i => i.isPreOrder).reduce((s, i) => s + i.unitPrice * i.qty, 0)
      return state.items.filter(i => state.selectedItemIds.includes(i.id)).reduce((s, i) => s + i.unitPrice * i.qty, 0)
    },
    canCheckout: (state) => {
      if (state.checkoutType === 'stock')    return state.items.filter(i => !i.isPreOrder).reduce((s, i) => s + i.unitPrice * i.qty, 0) > 0
      if (state.checkoutType === 'preorder') return state.items.filter(i => i.isPreOrder).length > 0
      const total = state.items.filter(i => state.selectedItemIds.includes(i.id)).reduce((s, i) => s + i.unitPrice * i.qty, 0)
      return total > 0
    },
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

      // Auto-create member record（email 註冊）
      const auth2 = useAuthStore()
      const email = auth2.user?.email || ''

      // 取預設會員等級（SortOrder 最小的那筆）
      const { data: defaultLevel } = await db
        .from('S_MBR_MemberLevelList')
        .select('ID')
        .order('SortOrder')
        .limit(1)
        .maybeSingle()

      const { data: created, error: createErr } = await db
        .from('C_MBR_MemberList')
        .insert({
          UserID:         userId,
          Email:          email,
          IsActive:       true,
          RegisterSource: 'email',
          MemberLevelID:  defaultLevel?.ID ?? null,
        })
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
        .select('ID, ProductID, VariantID, Qty, Source, LiveSessionID, IsReward, RewardAmt')
        .eq('CartID', this.cartId)
        .is('CancelledAt', null)  // 排除週期銷單軟刪除的品項（管理員手動移除為硬刪，不影響此）

      if (error) throw error
      if (!rawItems || rawItems.length === 0) {
        this.items = []
        return
      }

      // 購物金項目不需要查商品資料
      const rewardItems = rawItems.filter(i => i.IsReward)
      const productItems = rawItems.filter(i => !i.IsReward)

      if (!productItems.length) {
        this.items = rewardItems.map(item => ({
          id:            item.ID,
          productId:     null,
          variantId:     null,
          qty:           1,
          productName:   '購物金',
          unitPrice:     -(item.RewardAmt ?? 0),
          colorName:     '',
          sizeName:      '',
          stockQty:      Infinity,
          isPreOrder:    false,
          preOrderShipDate: null,
          imgUrl:        null,
          imgType:       'image',
          isReward:      true,
          rewardAmt:     item.RewardAmt ?? 0,
          source:        item.Source ?? 'web',
          liveSessionId: item.LiveSessionID ?? null,
        }))
        return
      }

      const productIds = [...new Set(productItems.map(i => i.ProductID).filter(Boolean))]
      const variantIds = [...new Set(productItems.map(i => i.VariantID).filter(Boolean))]

      // Parallel fetches
      const [
        { data: products },
        { data: variants },
      ] = await Promise.all([
        db.from('C_PRD_ProductList')
          .select('ID, ProductName, Price, IsPreOrder, C_PRD_ProductPictureList(StoragePath, IsMain, Type)')
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

      const mappedProductItems = productItems.map(item => {
        const product = productMap[item.ProductID] || {}
        const variant = variantMap[item.VariantID] || {}
        const media = getThumb(product)

        return {
          id:            item.ID,
          productId:     item.ProductID,
          variantId:     item.VariantID,
          qty:           item.Qty,
          productName:   product.ProductName || '',
          unitPrice:     product.Price || 0,
          colorName:     colorMap[variant.ColorID] || '',
          sizeName:      sizeMap[variant.SizeID] || '',
          stockQty:      variant.StockQty ?? 0,
          isPreOrder:    !!(product.IsPreOrder) && (variant.StockQty ?? 0) <= 0,
          preOrderShipDate: null,
          imgUrl:        media?.url || null,
          imgType:       media?.type || 'image',
          isReward:      false,
          rewardAmt:     0,
          source:        item.Source ?? 'web',
          liveSessionId: item.LiveSessionID ?? null,
        }
      })

      const mappedRewardItems = rewardItems.map(item => ({
        id:            item.ID,
        productId:     null,
        variantId:     null,
        qty:           1,
        productName:   '購物金',
        unitPrice:     -(item.RewardAmt ?? 0),
        colorName:     '',
        sizeName:      '',
        stockQty:      Infinity,
        isPreOrder:    false,
        preOrderShipDate: null,
        imgUrl:        null,
        imgType:       'image',
        isReward:      true,
        rewardAmt:     item.RewardAmt ?? 0,
        source:        item.Source ?? 'reward',
        liveSessionId: item.LiveSessionID ?? null,
      }))

      this.items = [...mappedProductItems, ...mappedRewardItems]
    },

    async addItem(productId, variantId, qty = 1, { source = 'web', liveSessionId = null } = {}) {
      if (!this.cartId) await this.fetchCart()

      // items 可能尚未載入（頁面重整後），先確保是最新狀態再檢查重複
      if (this.items.length === 0) await this._loadItems()

      const existing = this.items.find(i => i.variantId === variantId && !i.isReward)
      if (existing) {
        await this.updateQty(existing.id, existing.qty + qty)
        return
      }

      // ── 檢查 DB 中是否有已軟刪除的舊 row（CancelledAt IS NOT NULL）──
      // 週期銷單 cron 會 soft-delete，但 unique constraint 仍存在，不可重複 insert
      const { data: cancelledRow } = await db
        .from('C_CART_CartItemList')
        .select('ID, Qty')
        .eq('CartID', this.cartId)
        .eq('VariantID', variantId)
        .not('CancelledAt', 'is', null)
        .maybeSingle()

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

      if (cancelledRow) {
        // 復活已軟刪除的 row：清除 CancelledAt 並更新數量、預購狀態
        const { error } = await db
          .from('C_CART_CartItemList')
          .update({ CancelledAt: null, Qty: qty, IsPreOrderItem: isPreOrder })
          .eq('ID', cancelledRow.ID)
        if (error) {
          if (!isPreOrder) await db.rpc('restore_stock', { p_variant_id: variantId, p_qty: qty })
          throw error
        }
      } else {
        const row = {
          CartID: this.cartId,
          ProductID: productId,
          VariantID: variantId,
          Qty: qty,
          Source: source,
          IsPreOrderItem: isPreOrder,   // 記錄加入時的預購狀態，cron 以此判斷是否清除
        }
        if (liveSessionId) row.LiveSessionID = liveSessionId

        const { error } = await db
          .from('C_CART_CartItemList')
          .insert(row)
          .select('ID')
          .single()

        if (error) {
          if (!isPreOrder) await db.rpc('restore_stock', { p_variant_id: variantId, p_qty: qty })
          throw error
        }
      }

      await this._loadItems()
    },

    // 新增購物金項目（IsReward = true，無商品）
    async addReward(rewardAmt) {
      if (!this.cartId) await this.fetchCart()

      // 同一購物車只允許一筆購物金
      const existing = this.items.find(i => i.isReward)
      if (existing) return  // 已有購物金，不重複加

      const { error } = await db
        .from('C_CART_CartItemList')
        .insert({ CartID: this.cartId, IsReward: true, RewardAmt: rewardAmt, Qty: 1, Source: 'reward' })

      if (error) throw error
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
      this.checkoutType = null
    },
  },
})
