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

    const body = await req.json()
    const { action, memberId, cartItemId, itemIds, variantId, newQty } = body

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

      // 依 variantId 合併相同品項，排序依商品名稱
      const grouped: Record<number, any> = {}
      for (const ci of cartItems) {
        const spec = varMap[ci.VariantID] as any
        const key  = ci.VariantID
        if (!grouped[key]) {
          grouped[key] = {
            ids:         [],
            productName: prodMap[ci.ProductID] || '–',
            colorName:   colorMap[spec?.ColorID] || '',
            sizeName:    sizeMap[spec?.SizeID]   || '',
            qty:         0,
            variantId:   ci.VariantID,
          }
        }
        grouped[key].ids.push(ci.ID)
        grouped[key].qty += ci.Qty
      }

      const items = Object.values(grouped).sort((a: any, b: any) =>
        a.productName.localeCompare(b.productName, 'zh-TW')
      )

      return json({ items })
    }

    // ── UPDATE-QTY：調整數量 ─────────────────────────────────
    if (action === 'update-qty') {
      const ids     = itemIds as number[]
      const variant = variantId as number
      const qty     = newQty as number

      if (!ids?.length || !variant || qty == null || qty < 0) return json({ error: '缺少必要參數' }, 400)

      // 取目前所有列的總數量
      const { data: rows } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .select('ID, Qty').in('ID', ids).is('CancelledAt', null)

      const currentTotal = (rows ?? []).reduce((s: number, r: any) => s + r.Qty, 0)
      const diff = qty - currentTotal  // 負 = 減少，正 = 增加（不支援）

      if (qty === 0) {
        // 全部移除
        await admin.schema(dbSchema).rpc('restore_stock', { p_variant_id: variant, p_qty: currentTotal })
        await admin.schema(dbSchema).from('C_CART_CartItemList')
          .delete().in('ID', ids)
      } else if (diff < 0) {
        // 減少庫存補回
        await admin.schema(dbSchema).rpc('restore_stock', { p_variant_id: variant, p_qty: Math.abs(diff) })
        // 更新第一列為新總數，其餘直接刪除
        const sorted = [...(rows ?? [])].sort((a: any, b: any) => a.ID - b.ID)
        await admin.schema(dbSchema).from('C_CART_CartItemList')
          .update({ Qty: qty }).eq('ID', sorted[0].ID)
        if (sorted.length > 1) {
          await admin.schema(dbSchema).from('C_CART_CartItemList')
            .delete()
            .in('ID', sorted.slice(1).map((r: any) => r.ID))
        }
      }
      // diff > 0（增加）不支援

      return json({ success: true })
    }

    // ── REMOVE：移除全部該品項 + 回補庫存 ───────────────────
    if (action === 'remove') {
      const ids = itemIds as number[]
      if (!ids?.length) return json({ error: '缺少 itemIds' }, 400)

      const { data: rows } = await admin
        .schema(dbSchema).from('C_CART_CartItemList')
        .select('ID, VariantID, Qty').in('ID', ids).is('CancelledAt', null)

      for (const row of rows ?? []) {
        await admin.schema(dbSchema).rpc('restore_stock', { p_variant_id: row.VariantID, p_qty: row.Qty })
      }
      await admin.schema(dbSchema).from('C_CART_CartItemList')
        .delete().in('ID', ids)

      return json({ success: true })
    }

    return json({ error: '不支援的 action' }, 400)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[manage-member-cart] error:', msg)
    return json({ error: msg }, 500)
  }
})
