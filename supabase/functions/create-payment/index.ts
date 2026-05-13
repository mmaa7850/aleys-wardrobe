import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// AES-256-CBC 加密 — 使用 Web Crypto 標準 PKCS7-16 padding
// 藍新 PHP 的 strippadding() 可正確識別並移除此 padding
async function aesEncrypt(plaintext: string, key: string, iv: string): Promise<string> {
  const keyBytes = new Uint8Array(32)
  keyBytes.set(new TextEncoder().encode(key).slice(0, 32))
  const ivBytes = new Uint8Array(16)
  ivBytes.set(new TextEncoder().encode(iv).slice(0, 16))

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  )
  const data = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, cryptoKey, data)
  return Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Upper(str: string): Promise<string> {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const {
      orderNo, amount, shippingFee = 0, shippingMethodCode = 'cvscom', shippingAddress = '',
      couponCode, email, itemDesc, recipientName, recipientPhone, customerNote, items,
      invoiceCarrierType = null, invoiceCarrierNum = null,
      invoiceLoveCode = null, invoiceBuyerUBN = null, invoiceBuyerName = null,
    } = body

    if (!orderNo || !amount || !email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const hashKey = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const env = Deno.env.get('NEWEBPAY_ENV') || 'test'
    const siteUrl = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'

    const gatewayUrl = env === 'prod'
      ? 'https://core.newebpay.com/MPG/mpg_gateway'
      : 'https://ccore.newebpay.com/MPG/mpg_gateway'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 驗證優惠券（後端再次確認，防止前端繞過）
    const today = new Date().toISOString().slice(0, 10)
    let discountAmount = 0
    let couponId: number | null = null
    let couponUsageCount = 0

    if (couponCode) {
      const { data: coupon, error: couponErr } = await supabaseAdmin
        .schema(dbSchema)
        .from('S_PRM_CouponList')
        .select('ID, DiscountValue, UsageCount, MinOrderAmount')
        .eq('Name', couponCode)
        .eq('IsActive', true)
        .lte('StartDate', today)
        .gte('EndDate', today)
        .gt('UsageCount', 0)
        .single()

      if (couponErr || !coupon) {
        return new Response(JSON.stringify({ error: '優惠券無效或已過期' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (coupon.MinOrderAmount && amount < coupon.MinOrderAmount) {
        return new Response(JSON.stringify({ error: `此優惠券需消費滿 NT$ ${coupon.MinOrderAmount} 才可使用` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      discountAmount  = coupon.DiscountValue
      couponId        = coupon.ID
      couponUsageCount = coupon.UsageCount
    }

    // 滿額自動折抵 — 後端自動偵測最佳適用優惠
    let autoDiscountAmount = 0
    let autoDiscountCouponId: number | null = null
    let autoDiscountUsageCount = 0

    const { data: allAutoCoupons } = await supabaseAdmin
      .schema(dbSchema)
      .from('S_PRM_CouponList')
      .select('ID, DiscountValue, UsageCount, MinOrderAmount')
      .eq('IsActive', true)
      .eq('IsAutoApply', true)
      .lte('StartDate', today)
      .gte('EndDate', today)
      .gt('UsageCount', 0)

    if (allAutoCoupons && allAutoCoupons.length > 0) {
      const applicable = allAutoCoupons.filter((c: { MinOrderAmount: number | null }) =>
        !c.MinOrderAmount || amount >= c.MinOrderAmount
      )
      if (applicable.length > 0) {
        applicable.sort((a: { MinOrderAmount: number | null }, b: { MinOrderAmount: number | null }) =>
          (b.MinOrderAmount ?? 0) - (a.MinOrderAmount ?? 0)
        )
        const best = applicable[0] as { ID: number; DiscountValue: number; UsageCount: number }
        autoDiscountAmount = best.DiscountValue
        autoDiscountCouponId = best.ID
        autoDiscountUsageCount = best.UsageCount
      }
    }

    const finalAmount = Math.max(1, amount + shippingFee - discountAmount - autoDiscountAmount)

    // 結帳前檢查庫存
    const variantIds = (items as Array<{ variantId: number; qty: number; productName: string }>).map(i => i.variantId)
    const { data: variants } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_PRD_ProductVariantList')
      .select('ID, StockQty')
      .in('ID', variantIds)

    for (const item of items as Array<{ variantId: number; qty: number; productName: string }>) {
      const v = variants?.find((x: { ID: number; StockQty: number }) => x.ID === item.variantId)
      if (!v || v.StockQty < item.qty) {
        return new Response(JSON.stringify({
          error: `「${item.productName}」庫存不足，請調整數量後再試`
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { data: order, error: orderErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .insert({
        OrderNo: orderNo,
        CustomerName: recipientName,
        CustomerEmail: email,
        CustomerPhone: recipientPhone,
        ShippingName: recipientName,
        ShippingPhone: recipientPhone,
        ShippingAddress: '',
        ShippingFee: shippingFee,
        PaymentStatus: 'pending',
        CouponID: couponId,
        ItemsTotal: amount,
        DiscountAmount: discountAmount + autoDiscountAmount,
        FinalAmount: finalAmount,
        CustomerNote: customerNote || null,
        ShippingMethod: shippingMethodCode,
        ShippingAddress: shippingAddress || '',
        StoreID: null,
        StoreName: null,
        InvoiceCarrierType: invoiceCarrierType,
        InvoiceCarrierNum:  invoiceCarrierNum,
        InvoiceLoveCode:    invoiceLoveCode,
        InvoiceBuyerUBN:    invoiceBuyerUBN,
        InvoiceBuyerName:   invoiceBuyerName,
      })
      .select('ID')
      .single()

    if (orderErr) throw new Error(`Order insert failed: ${orderErr.message}`)

    const orderItems = (items as Array<{
      productId: number; productName: string; variantId: number
      colorName: string; sizeName: string; unitPrice: number; qty: number
    }>).map(item => ({
      OrderID: order.ID,
      ProductID: item.productId,
      ProductName: item.productName,
      VariantID: item.variantId,
      ColorName: item.colorName,
      SizeName: item.sizeName,
      UnitPrice: item.unitPrice,
      Qty: item.qty,
      SubTotal: item.unitPrice * item.qty,
    }))

    const { error: itemsErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderItemList')
      .insert(orderItems)

    if (itemsErr) throw new Error(`Items insert failed: ${itemsErr.message}`)

    // 扣除手動優惠券使用次數
    if (couponId !== null) {
      await supabaseAdmin
        .schema(dbSchema)
        .from('S_PRM_CouponList')
        .update({ UsageCount: couponUsageCount - 1, UpdatedDate: new Date().toISOString() })
        .eq('ID', couponId)
    }

    // 扣除自動折抵優惠券使用次數
    if (autoDiscountCouponId !== null) {
      await supabaseAdmin
        .schema(dbSchema)
        .from('S_PRM_CouponList')
        .update({ UsageCount: autoDiscountUsageCount - 1, UpdatedDate: new Date().toISOString() })
        .eq('ID', autoDiscountCouponId)
    }

    const timeStamp = Math.floor(Date.now() / 1000)

    const pad = (n: number) => String(n).padStart(2, '0')

    // ATM 轉帳繳費期限 3 天
    const atmExpire = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const expireDate = `${atmExpire.getFullYear()}${pad(atmExpire.getMonth()+1)}${pad(atmExpire.getDate())}`

    const isCVS = shippingMethodCode === 'cvscom'

    const params: Record<string, string | number> = {
      Amt: finalAmount,
      ClientBackURL: `${siteUrl}/orders/${orderNo}`,
      CREDIT: 1,
      CustomerURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-return`,
      Email: email,
      ExpireDate: expireDate,
      ItemDesc: (itemDesc || '商品購買').slice(0, 50),
      MerchantID: merchantId,
      MerchantOrderNo: orderNo,
      NotifyURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-notify`,
      RespondType: 'JSON',
      ReturnURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-return`,
      TimeStamp: timeStamp,
      VACC: 1,
      Version: '2.0',
    }

    // 超商取貨：加入 CVSCOM 物流參數；宅配不需要
    if (isCVS) {
      params['CVSCOM'] = 1
      params['LgsType'] = 'C2C'
    }

    const sortedKeys = Object.keys(params).sort()
    const queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')

    const tradeInfo = await aesEncrypt(queryStr, hashKey, hashIV)
    const tradeSha = await sha256Upper(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)

    return new Response(JSON.stringify({
      gatewayUrl,
      MerchantID: merchantId,
      TradeInfo: tradeInfo,
      TradeSha: tradeSha,
      TimeStamp: timeStamp,
      Version: '2.0',
      MerchantOrderNo: orderNo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[create-payment] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
