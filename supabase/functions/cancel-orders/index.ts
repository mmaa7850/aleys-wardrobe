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

    async function restoreStock(variantId: number, qty: number) {
      await admin.schema(dbSchema).rpc('restore_stock', { p_variant_id: variantId, p_qty: qty })
    }

    // 跨 Part A/B 收集要封鎖的 email
    const emailsToBlock = new Set<string>()

    let cancelledCount = 0
    let cartCleared    = 0

    // ══ Part A：取消 pending/failed 訂單 ══════════════════════

    const { data: orders, error: ordErr } = await admin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, OrderNo, CustomerEmail')
      .in('PaymentStatus', ['pending', 'failed'])

    if (ordErr) throw new Error(ordErr.message ?? JSON.stringify(ordErr))

    if (orders?.length) {
      const orderIds = orders.map(o => o.ID)

      // 回補訂單庫存
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

      // 收集 email
      for (const o of orders) {
        if (o.CustomerEmail) emailsToBlock.add(o.CustomerEmail)
      }
    }

    // ══ Part B：清購物車現貨品（真預購除外）══════════════════════
    // 邏輯與 weekly_cancel_job()（fix_cron_and_cart_preorder.sql）一致：
    // 用加入購物車當下快照的 IsPreOrderItem 判斷，而非即時查 Product/Variant，
    // 並排除已軟刪除（CancelledAt 非 null）的 row，避免重複回補庫存。

    const { data: cartItems, error: cartErr } = await admin
      .schema(dbSchema)
      .from('C_CART_CartItemList')
      .select('ID, CartID, VariantID, Qty')
      .eq('IsReward', false)
      .eq('IsPreOrderItem', false)
      .is('CancelledAt', null)

    if (cartErr) throw new Error(cartErr.message ?? JSON.stringify(cartErr))

    if (cartItems?.length) {
      // 回補庫存
      const cartStockMap: Record<number, number> = {}
      for (const item of cartItems) {
        if (!item.VariantID) continue
        cartStockMap[item.VariantID] = (cartStockMap[item.VariantID] ?? 0) + item.Qty
      }
      for (const [vid, qty] of Object.entries(cartStockMap)) {
        await restoreStock(Number(vid), qty)
      }

      // 軟刪除：標記 CancelledAt（保留紀錄供 Tab2 顯示）
      const deleteIds = cartItems.map(i => i.ID)
      const { error: delErr } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .update({ CancelledAt: new Date().toISOString() })
        .in('ID', deleteIds)
      if (delErr) throw new Error(delErr.message ?? JSON.stringify(delErr))
      cartCleared = deleteIds.length

      // 收集被清購物車的會員 email（CartItem → Cart → Member）
      const cartIds = [...new Set(cartItems.map(i => i.CartID).filter(Boolean))]
      if (cartIds.length) {
        const { data: carts } = await admin
          .schema(dbSchema).from('C_CART_CartList').select('MemberID').in('ID', cartIds)
        const memberIds = [...new Set((carts ?? []).map(c => c.MemberID).filter(Boolean))]
        if (memberIds.length) {
          const { data: cartMembers } = await admin
            .schema(dbSchema).from('C_MBR_MemberList').select('Email').in('ID', memberIds)
          for (const m of cartMembers ?? []) {
            if (m.Email) emailsToBlock.add(m.Email)
          }
        }
      }
    }

    // ══ 統一封鎖（訂單 + 購物車被清的會員）══════════════════════

    let blockedCount = 0
    if (emailsToBlock.size > 0) {
      const { error: blockErr } = await admin
        .schema(dbSchema)
        .from('C_MBR_MemberList')
        .update({ IsBlocked: true, UpdatedDate: new Date().toISOString() })
        .in('Email', [...emailsToBlock])

      if (blockErr) console.error('[cancel-orders] 封鎖會員失敗:', blockErr.message)
      else blockedCount = emailsToBlock.size
    }

    console.log(`[cancel-orders] 銷訂單 ${cancelledCount} 筆，清購物車 ${cartCleared} 筆，封鎖 ${blockedCount} 位會員`)
    return json({ cancelled: cancelledCount, cartCleared, blocked: blockedCount, orderNos: (orders ?? []).map(o => o.OrderNo) })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cancel-orders] error:', msg)
    return json({ error: msg }, 500)
  }
})
