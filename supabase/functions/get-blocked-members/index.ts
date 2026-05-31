import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function thisWeekMondayUTC(): string {
  const now = new Date()
  const OFFSET_MS = 8 * 60 * 60 * 1000
  const taiwanNow = new Date(now.getTime() + OFFSET_MS)
  const dow = taiwanNow.getUTCDay()
  const daysSinceMon = dow === 0 ? 6 : dow - 1
  const mondayTaiwan = new Date(taiwanNow)
  mondayTaiwan.setUTCDate(taiwanNow.getUTCDate() - daysSinceMon)
  mondayTaiwan.setUTCHours(0, 0, 0, 0)
  return new Date(mondayTaiwan.getTime() - OFFSET_MS).toISOString()
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

    const { data: adminUser } = await admin
      .schema(dbSchema).from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive').eq('UserId', user.id).single()
    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    const since = thisWeekMondayUTC()

    // 1. 本週被封鎖的會員
    const { data: blockedMembers, error: mbrErr } = await admin
      .schema(dbSchema).from('C_MBR_MemberList')
      .select('ID, FbName, Email, LineUserID, UpdatedDate')
      .eq('IsBlocked', true)
      .gte('UpdatedDate', since)
    if (mbrErr) throw new Error(mbrErr.message)
    if (!blockedMembers?.length) return json({ members: [] })

    const emails    = blockedMembers.map(m => m.Email).filter(Boolean)
    const memberIds = blockedMembers.map(m => m.ID)

    // 2. 本週已取消訂單
    const { data: orders } = await admin
      .schema(dbSchema).from('C_ORD_OrderList')
      .select('ID, OrderNo, CustomerEmail, FinalAmount, UpdatedDate')
      .eq('PaymentStatus', 'cancelled')
      .gte('UpdatedDate', since)
      .in('CustomerEmail', emails)

    // 3. 訂單明細
    const orderIds = (orders ?? []).map(o => o.ID)
    let itemsByOrder: Record<number, object[]> = {}
    if (orderIds.length) {
      const { data: orderItems } = await admin
        .schema(dbSchema).from('C_ORD_OrderItemList')
        .select('OrderID, ProductName, ColorName, SizeName, Qty')
        .in('OrderID', orderIds)
      for (const it of orderItems ?? []) {
        if (!itemsByOrder[it.OrderID]) itemsByOrder[it.OrderID] = []
        itemsByOrder[it.OrderID].push(it)
      }
    }

    // 4. 本週被清的購物車品項（CancelledAt >= since）
    const { data: memberCarts } = await admin
      .schema(dbSchema).from('C_CART_CartList')
      .select('ID, MemberID').in('MemberID', memberIds)

    const allCartIds = (memberCarts ?? []).map(c => c.ID)
    const cartToMember: Record<number, number> = Object.fromEntries(
      (memberCarts ?? []).map(c => [c.ID, c.MemberID])
    )

    let cartItemsByMember: Record<number, object[]> = {}
    if (allCartIds.length) {
      const { data: cCartItems } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .select('ID, CartID, ProductID, VariantID, Qty')
        .in('CartID', allCartIds)
        .gte('CancelledAt', since)
        .not('CancelledAt', 'is', null)

      if (cCartItems?.length) {
        const pIds = [...new Set(cCartItems.map(i => i.ProductID).filter(Boolean))]
        const vIds = [...new Set(cCartItems.map(i => i.VariantID).filter(Boolean))]
        const [{ data: prods }, { data: vars }] = await Promise.all([
          admin.schema(dbSchema).from('C_PRD_ProductList').select('ID, ProductName').in('ID', pIds),
          admin.schema(dbSchema).from('C_PRD_ProductVariantList').select('ID, ColorName, SizeName').in('ID', vIds),
        ])
        const prodMap = Object.fromEntries((prods ?? []).map(p => [p.ID, p.ProductName]))
        const varMap  = Object.fromEntries((vars  ?? []).map(v => [v.ID, v]))

        for (const ci of cCartItems) {
          const mid = cartToMember[ci.CartID]
          if (!mid) continue
          if (!cartItemsByMember[mid]) cartItemsByMember[mid] = []
          const spec = varMap[ci.VariantID] as any
          cartItemsByMember[mid].push({
            ProductName: prodMap[ci.ProductID] || '–',
            ColorName:   spec?.ColorName || '',
            SizeName:    spec?.SizeName  || '',
            qty:         ci.Qty,
          })
        }
      }
    }

    // 5. 組合結果
    const ordersByEmail: Record<string, object[]> = {}
    for (const ord of orders ?? []) {
      if (!ordersByEmail[ord.CustomerEmail]) ordersByEmail[ord.CustomerEmail] = []
      ordersByEmail[ord.CustomerEmail].push(ord)
    }

    const members = blockedMembers.map(m => {
      const memberOrders = (ordersByEmail[m.Email] ?? []) as any[]
      const orderItems   = memberOrders.flatMap(o => (itemsByOrder[o.ID] ?? []) as any[])
      const cartItems    = (cartItemsByMember[m.ID] ?? []) as any[]
      const items        = memberOrders.length ? orderItems : cartItems
      const totalAmount  = memberOrders.reduce((s: number, o: any) => s + (o.FinalAmount ?? 0), 0)

      return {
        key:        `cancelled_${m.ID}`,
        memberId:   m.ID,
        fbName:     m.FbName || m.Email || '',
        email:      m.Email  || '',
        lineUserId: m.LineUserID || null,
        hasLine:    !!m.LineUserID,
        orderCount: memberOrders.length,
        totalAmount,
        items,
        cancelledAt: m.UpdatedDate,
        cartOnly:   memberOrders.length === 0,
      }
    }).sort((a, b) => new Date(b.cancelledAt).getTime() - new Date(a.cancelledAt).getTime())

    return json({ members })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[get-blocked-members] error:', msg)
    return json({ error: msg }, 500)
  }
})
