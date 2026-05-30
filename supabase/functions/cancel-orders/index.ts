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

    // 1. 找所有 pending 訂單
    const { data: orders, error: ordErr } = await admin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, OrderNo')
      .eq('PaymentStatus', 'pending')

    if (ordErr) throw ordErr
    if (!orders?.length) return json({ cancelled: 0, message: '沒有待取消的訂單' })

    const orderIds = orders.map(o => o.ID)

    // 2. 取訂單明細（回補庫存用）
    const { data: items, error: itemErr } = await admin
      .schema(dbSchema)
      .from('C_ORD_OrderItemList')
      .select('VariantID, Qty')
      .in('OrderID', orderIds)

    if (itemErr) throw itemErr

    // 3. 取消所有 pending 訂單
    const { error: cancelErr } = await admin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .update({ PaymentStatus: 'cancelled', UpdatedDate: new Date().toISOString() })
      .in('ID', orderIds)

    if (cancelErr) throw cancelErr

    // 4. 回補庫存（逐一 rpc increment，無 rpc 則用 select+update）
    const stockMap: Record<number, number> = {}
    for (const item of items ?? []) {
      if (!item.VariantID) continue
      stockMap[item.VariantID] = (stockMap[item.VariantID] ?? 0) + item.Qty
    }

    for (const [variantId, qty] of Object.entries(stockMap)) {
      const { data: v } = await admin
        .schema(dbSchema)
        .from('C_PRD_ProductVariantList')
        .select('StockQty')
        .eq('ID', Number(variantId))
        .single()

      if (v) {
        await admin
          .schema(dbSchema)
          .from('C_PRD_ProductVariantList')
          .update({ StockQty: (v.StockQty ?? 0) + qty })
          .eq('ID', Number(variantId))
      }
    }

    console.log(`[cancel-orders] 銷單 ${orders.length} 筆，回補庫存 ${Object.keys(stockMap).length} 個 variant`)
    return json({ cancelled: orders.length, orderNos: orders.map(o => o.OrderNo) })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cancel-orders] error:', msg)
    return json({ error: msg }, 500)
  }
})
