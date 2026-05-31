import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 僅管理員可執行
    const { data: adminUser } = await admin
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive')
      .eq('UserId', user.id)
      .single()

    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    // ── 共用：restore_stock RPC ───────────────────────────────
    async function restoreStock(variantId: number, qty: number) {
      await admin.schema(dbSchema).rpc('restore_stock', {
        p_variant_id: variantId,
        p_qty: qty,
      })
    }

    // ══ Part A：取消 pending/failed 訂單 ══════════════════════

    const { data: orders, error: ordErr } = await admin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, OrderNo, CustomerEmail')
      .in('PaymentStatus', ['pending', 'failed'])

    if (ordErr) throw new Error(ordErr.message ?? JSON.stringify(ordErr))

    let cancelledCount = 0
    let blockedCount   = 0

    if (orders?.length) {
      const orderIds = orders.map(o => o.ID)

      // 取訂單明細，回補庫存
      const { data: orderItems, error: itemErr } = await admin
        .schema(dbSchema)
        .from('C_ORD_OrderItemList')
        .select('VariantID, Qty')
        .in('OrderID', orderIds)

      if (itemErr) throw new Error(itemErr.message ?? JSON.stringify(itemErr))

      const orderStockMap: Record<number, number> = {}
      for (const item of orderItems ?? []) {
        if (!item.VariantID) continue
        orderStockMap[item.VariantID] = (orderStockMap[item.VariantID] ?? 0) + item.Qty
      }
      for (const [vid, qty] of Object.entries(orderStockMap)) {
        await restoreStock(Number(vid), qty)
      }

      // 取消訂單
      const { error: cancelErr } = await admin
        .schema(dbSchema)
        .from('C_ORD_OrderList')
        .update({ PaymentStatus: 'cancelled', UpdatedDate: new Date().toISOString() })
        .in('ID', orderIds)

      if (cancelErr) throw new Error(cancelErr.message ?? JSON.stringify(cancelErr))
      cancelledCount = orders.length

      // 封鎖會員
      const emails = [...new Set(orders.map(o => o.CustomerEmail).filter(Boolean))]
      if (emails.length) {
        const { error: blockErr } = await admin
          .schema(dbSchema)
          .from('C_MBR_MemberList')
          .update({ IsBlocked: true, UpdatedDate: new Date().toISOString() })
          .in('Email', emails)

        if (blockErr) console.error('[cancel-orders] 封鎖會員失敗:', blockErr.message)
        else blockedCount = emails.length
      }
    }

    // ══ Part B：清購物車現貨品（預購除外）══════════════════════

    // 1. 取全部非購物金的購物車明細
    const { data: cartItems, error: cartErr } = await admin
      .schema(dbSchema)
      .from('C_CART_CartItemList')
      .select('ID, ProductID, VariantID, Qty')
      .eq('IsReward', false)

    if (cartErr) throw new Error(cartErr.message ?? JSON.stringify(cartErr))

    let cartCleared = 0

    if (cartItems?.length) {
      // 2. 查商品 IsPreOrder 及 variant 目前庫存
      const productIds = [...new Set(cartItems.map(i => i.ProductID).filter(Boolean))]
      const variantIds = [...new Set(cartItems.map(i => i.VariantID).filter(Boolean))]

      const [{ data: products }, { data: variants }] = await Promise.all([
        admin.schema(dbSchema).from('C_PRD_ProductList')
          .select('ID, IsPreOrder').in('ID', productIds),
        admin.schema(dbSchema).from('C_PRD_ProductVariantList')
          .select('ID, StockQty').in('ID', variantIds),
      ])

      const productMap = Object.fromEntries((products ?? []).map(p => [p.ID, p]))
      const variantMap = Object.fromEntries((variants ?? []).map(v => [v.ID, v]))

      // 3. 篩出要清除的品項
      //    略過：IsPreOrder=true 且 StockQty=0（真正無庫存的預購）
      //    清除：IsPreOrder=false，或 IsPreOrder=true 但有庫存（現貨下單）
      const toDelete = cartItems.filter(i => {
        const p = productMap[i.ProductID]
        const v = variantMap[i.VariantID]
        const isTruePreOrder = p?.IsPreOrder && (v?.StockQty ?? 0) <= 0
        return !isTruePreOrder
      })

      if (toDelete.length) {
        // 4. 回補庫存
        const cartStockMap: Record<number, number> = {}
        for (const item of toDelete) {
          if (!item.VariantID) continue
          cartStockMap[item.VariantID] = (cartStockMap[item.VariantID] ?? 0) + item.Qty
        }
        for (const [vid, qty] of Object.entries(cartStockMap)) {
          await restoreStock(Number(vid), qty)
        }

        // 5. 刪除購物車明細
        const deleteIds = toDelete.map(i => i.ID)
        const { error: delErr } = await admin
          .schema(dbSchema)
          .from('C_CART_CartItemList')
          .delete()
          .in('ID', deleteIds)

        if (delErr) throw new Error(delErr.message ?? JSON.stringify(delErr))
        cartCleared = deleteIds.length
      }
    }

    console.log(`[cancel-orders] 銷訂單 ${cancelledCount} 筆，清購物車 ${cartCleared} 筆，封鎖 ${blockedCount} 位會員`)
    return json({
      cancelled:   cancelledCount,
      cartCleared: cartCleared,
      blocked:     blockedCount,
      orderNos:    (orders ?? []).map(o => o.OrderNo),
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cancel-orders] error:', msg)
    return json({ error: msg }, 500)
  }
})
