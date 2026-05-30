import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const LINE_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SITE_URL = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'

// ── 產生直播訂單編號 ───────────────────────────────────────
function generateOrderNo(): string {
  const now = new Date()
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `LIV_${dateStr}_${rand}`
}

// ── 發 LINE 推播 ───────────────────────────────────────────
async function pushLine(lineUserId: string, text: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text }],
      }),
    })
  } catch {
    // 通知失敗不中斷訂單建立
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 驗證 JWT ─────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 驗證是否為啟用中的管理員 ──────────────────────────
    const { data: adminRow } = await supabase
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsActive')
      .eq('UserId', user.id)
      .single()

    if (!adminRow?.IsActive) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 讀取請求 body ─────────────────────────────────────
    // items: [{ livProductId, fbName, qty }]
    const { sessionId, items } = await req.json()

    if (!sessionId || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or items' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 取得直播場次商品對照表 ────────────────────────────
    const { data: livProducts, error: livProdErr } = await supabase
      .schema(dbSchema)
      .from('C_LIV_ProductList')
      .select('ID, SessionID, Code, ColorName, SizeName, VariantID, ProductName, LivePrice')
      .eq('SessionID', sessionId)

    if (livProdErr) throw new Error('無法讀取直播商品資料')

    const livProductMap = new Map(livProducts?.map(p => [p.ID, p]) ?? [])

    // ── 取得宅配到府運費 ──────────────────────────────────
    const { data: shippingMethod } = await supabase
      .schema(dbSchema)
      .from('S_SHP_ShippingMethodList')
      .select('ID, Fee')
      .eq('MethodCode', 'home')
      .eq('IsActive', true)
      .single()

    const shippingFee = shippingMethod?.Fee ?? 0
    const shippingMethodId = shippingMethod?.ID ?? null

    // ── 逐筆處理 ─────────────────────────────────────────
    const results: {
      fbName: string
      productName: string
      status: 'success' | 'no_stock' | 'no_member' | 'error'
      orderNo?: string
      reason?: string
      lineNotified?: boolean
    }[] = []

    for (const item of items) {
      const { livProductId, fbName, qty = 1 } = item

      const livProduct = livProductMap.get(livProductId)
      if (!livProduct) {
        results.push({ fbName, productName: '–', status: 'error', reason: '商品對照表中找不到此項目' })
        continue
      }

      const productLabel = `${livProduct.ProductName} ${livProduct.ColorName} ${livProduct.SizeName}`

      try {
        // ── 查詢會員（by FbName）──────────────────────────
        const { data: members } = await supabase
          .schema(dbSchema)
          .from('C_MBR_MemberList')
          .select('ID, UserID, Name, Email, Phone, LineUserID, IsBlocked')
          .eq('FbName', fbName)
          .limit(1)

        const member = members?.[0] ?? null

        if (!member) {
          results.push({
            fbName,
            productName: productLabel,
            status: 'no_member',
            reason: `找不到 FbName="${fbName}" 的會員`,
          })
          continue
        }

        if (member.IsBlocked) {
          results.push({
            fbName,
            productName: productLabel,
            status: 'blocked',
            reason: '此會員因逾期未付款已被封鎖，無法建立直播訂單',
          })
          continue
        }

        // ── 取得預設地址 ──────────────────────────────────
        const { data: addresses } = await supabase
          .schema(dbSchema)
          .from('C_MBR_MemberAddressList')
          .select('RecipientName, RecipientPhone, Address')
          .eq('MemberID', member.ID)
          .eq('IsDefault', true)
          .limit(1)

        const addr = addresses?.[0] ?? null

        const shippingName    = addr?.RecipientName  || member.Name  || fbName
        const shippingPhone   = addr?.RecipientPhone || member.Phone || ''
        const shippingAddress = addr?.Address || ''

        // ── 扣庫存（原子性）──────────────────────────────
        // 使用正確 schema 呼叫 RPC；decrement_stock 回傳 false = 庫存不足
        const { data: stockOk, error: stockErr } = await supabase
          .schema(dbSchema)
          .rpc('decrement_stock', {
            p_variant_id: livProduct.VariantID,
            p_qty: qty,
          })

        if (stockErr || !stockOk) {
          results.push({
            fbName,
            productName: productLabel,
            status: 'no_stock',
            reason: '庫存不足',
          })
          continue
        }

        // ── 建立訂單 ──────────────────────────────────────
        const orderNo    = generateOrderNo()
        const itemsTotal = livProduct.LivePrice * qty
        const finalAmt   = itemsTotal + shippingFee

        const { data: orderData, error: orderErr } = await supabase
          .schema(dbSchema)
          .from('C_ORD_OrderList')
          .insert({
            OrderNo:          orderNo,
            CustomerName:     member.Name || fbName,
            CustomerEmail:    member.Email || '',
            CustomerPhone:    member.Phone || '',
            ShippingName:     shippingName,
            ShippingPhone:    shippingPhone,
            ShippingAddress:  shippingAddress,
            ShippingMethodID: shippingMethodId,
            ShippingFee:      shippingFee,
            ShippingMethod:   'home',
            PaymentStatus:    'pending',
            ItemsTotal:       itemsTotal,
            DiscountAmount:   0,
            FinalAmount:      finalAmt,
            WalletDeductAmt:  0,
            NewebpayAmt:      finalAmt,
            OrderSource:      'live',
            LiveSessionID:    sessionId,
          })
          .select('ID')
          .single()

        if (orderErr || !orderData) {
          // 庫存已扣但建單失敗（極少見），由管理員手動調整庫存
          results.push({ fbName, productName: productLabel, status: 'error', reason: '建單失敗，庫存已扣，請手動調整' })
          continue
        }

        // ── 建立訂單明細 ──────────────────────────────────
        await supabase
          .schema(dbSchema)
          .from('C_ORD_OrderItemList')
          .insert({
            OrderID:     orderData.ID,
            ProductID:   0, // 直播訂單不一定有完整商品資料，先填 0
            ProductName: livProduct.ProductName || '',
            VariantID:   livProduct.VariantID,
            ColorName:   livProduct.ColorName,
            SizeName:    livProduct.SizeName,
            UnitPrice:   livProduct.LivePrice,
            Qty:         qty,
            SubTotal:    itemsTotal,
          })

        // ── 發 LINE 通知 ──────────────────────────────────
        let lineNotified = false
        if (member.LineUserID) {
          const msg =
            `🎀 Aley's Wardrobe\n\n` +
            `您好！您的直播訂單已成功建立。\n\n` +
            `訂單編號：${orderNo}\n` +
            `商品：${livProduct.ProductName} ${livProduct.ColorName} ${livProduct.SizeName} × ${qty}\n` +
            `金額：NT$${finalAmt.toLocaleString()}\n\n` +
            `請點此連結完成付款：\n` +
            `${SITE_URL}/orders/${orderNo}\n\n` +
            `如有問題請聯繫小編 💬`
          await pushLine(member.LineUserID, msg)
          lineNotified = true
        }

        results.push({
          fbName,
          productName: productLabel,
          status: 'success',
          orderNo,
          lineNotified,
        })
      } catch (e) {
        results.push({
          fbName,
          productName: `${livProduct.ProductName || ''} ${livProduct.ColorName} ${livProduct.SizeName}`,
          status: 'error',
          reason: String(e),
        })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
