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

    const { data: adminUser } = await admin
      .schema(dbSchema).from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive').eq('UserId', user.id).single()
    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    const { action, memberId, cartItemId } = await req.json()

    // ── GET：取得會員購物車 ──────────────────────────────────
    if (action === 'get') {
      if (!memberId) return json({ error: '缺少 memberId' }, 400)

      const { data: carts } = await admin
        .schema(dbSchema).from('C_CART_CartList')
        .select('ID').eq('MemberID', memberId)

      const cartIds = (carts ?? []).map((c: any) => c.ID)
      if (!cartIds.length) return json({ items: [] })

      const { data: cartItems } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .select('ID, CartID, ProductID, VariantID, Qty')
        .in('CartID', cartIds)
        .is('CancelledAt', null)
        .eq('IsReward', false)

      if (!cartItems?.length) return json({ items: [] })

      const pIds = [...new Set(cartItems.map((i: any) => i.ProductID).filter(Boolean))]
      const vIds = [...new Set(cartItems.map((i: any) => i.VariantID).filter(Boolean))]

      const [{ data: prods }, { data: vars }] = await Promise.all([
        admin.schema(dbSchema).from('C_PRD_ProductList').select('ID, ProductName').in('ID', pIds),
        admin.schema(dbSchema).from('C_PRD_ProductVariantList').select('ID, ColorID, SizeID').in('ID', vIds),
      ])

      const colorIds = [...new Set((vars ?? []).map((v: any) => v.ColorID).filter(Boolean))]
      const sizeIds  = [...new Set((vars ?? []).map((v: any) => v.SizeID).filter(Boolean))]
      const [{ data: colors }, { data: sizes }] = await Promise.all([
        colorIds.length ? admin.schema(dbSchema).from('S_PRD_ColorList').select('ID, Name').in('ID', colorIds) : Promise.resolve({ data: [] }),
        sizeIds.length  ? admin.schema(dbSchema).from('S_PRD_SizeList').select('ID, Name').in('ID', sizeIds)   : Promise.resolve({ data: [] }),
      ])

      const prodMap  = Object.fromEntries((prods  ?? []).map((p: any) => [p.ID, p.ProductName]))
      const colorMap = Object.fromEntries((colors ?? []).map((c: any) => [c.ID, c.Name]))
      const sizeMap  = Object.fromEntries((sizes  ?? []).map((s: any) => [s.ID, s.Name]))
      const varMap   = Object.fromEntries((vars   ?? []).map((v: any) => [v.ID, v]))

      const items = cartItems.map((ci: any) => {
        const spec = varMap[ci.VariantID] as any
        return {
          id:          ci.ID,
          productName: prodMap[ci.ProductID] || '–',
          colorName:   colorMap[spec?.ColorID] || '',
          sizeName:    sizeMap[spec?.SizeID]   || '',
          qty:         ci.Qty,
          variantId:   ci.VariantID,
        }
      })

      return json({ items })
    }

    // ── REMOVE：移除購物車品項 + 回補庫存 ───────────────────
    if (action === 'remove') {
      if (!cartItemId) return json({ error: '缺少 cartItemId' }, 400)

      const { data: item } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .select('ID, VariantID, Qty').eq('ID', cartItemId).single()

      if (!item) return json({ error: '找不到購物車品項' }, 404)

      // 回補庫存
      await admin.schema(dbSchema).rpc('restore_stock', {
        p_variant_id: item.VariantID,
        p_qty:        item.Qty,
      })

      // 軟刪除
      await admin.schema(dbSchema).from('C_CART_CartItemList')
        .update({ CancelledAt: new Date().toISOString() })
        .eq('ID', cartItemId)

      return json({ success: true })
    }

    return json({ error: '不支援的 action' }, 400)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[manage-member-cart] error:', msg)
    return json({ error: msg }, 500)
  }
})
