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
      walletDeductAmt = 0,  // 本次從錢包扣款的金額
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

    const finalAmount    = Math.max(1, amount + shippingFee - discountAmount - autoDiscountAmount)
    const walletDeduct   = Math.max(0, Math.min(Number(walletDeductAmt), finalAmount))
    const newebpayAmount = finalAmount - walletDeduct  // 藍新實際收款金額（0 = 全額錢包）

    // 庫存已於加入購物車時扣除（decrement_stock RPC），此處不再重複檢查

    // ── 錢包扣款（walletDeduct > 0 時）────────────────────────────
    let walletBalanceBefore = 0
    let walletBalanceAfter  = 0
    if (walletDeduct > 0) {
      const { data: walletRow } = await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList')
        .select('Balance')
        .eq('MemberID', user.id)
        .maybeSingle()
      const currentBalance = walletRow?.Balance ?? 0
      if (currentBalance < walletDeduct) {
        return new Response(JSON.stringify({ error: `錢包餘額不足，目前餘額 NT$${currentBalance}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      walletBalanceBefore = currentBalance
      walletBalanceAfter  = currentBalance - walletDeduct
      await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList').update({
        Balance:     walletBalanceAfter,
        UpdatedDate: new Date().toISOString(),
      }).eq('MemberID', user.id)
    }

    // 查第一個訂單狀態（建立時即設定，不等付款）
    const { data: firstStatus } = await supabaseAdmin.schema(dbSchema)
      .from('S_ORD_StatusList').select('ID').order('ID', { ascending: true }).limit(1).single()

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
        PaymentStatus:   newebpayAmount === 0 ? 'paid' : 'pending',
        WalletDeductAmt: walletDeduct,
        NewebpayAmt:     newebpayAmount,
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
        ...(firstStatus?.ID ? { StatusID: firstStatus.ID } : {}),
      })
      .select('ID')
      .single()

    if (orderErr) {
      // 訂單建立失敗：退還已扣的錢包餘額
      if (walletDeduct > 0) {
        await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList').update({
          Balance:     walletBalanceBefore,
          UpdatedDate: new Date().toISOString(),
        }).eq('MemberID', user.id)
      }
      throw new Error(`Order insert failed: ${orderErr.message}`)
    }

    // 錢包扣款流水帳
    if (walletDeduct > 0) {
      await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletTxList').insert({
        MemberID:       user.id,
        TxType:         'order_deduct',
        Amount:         -walletDeduct,
        BalanceBefore:  walletBalanceBefore,
        BalanceAfter:   walletBalanceAfter,
        RelatedOrderNo: orderNo,
      })
    }

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

    // ── 全額錢包付款：扣庫存後直接回傳成功，不走藍新 ────────────
    if (newebpayAmount === 0) {
      const now = new Date().toISOString()

      // 補寫付款相關欄位（firstStatus 已在建立訂單前查好）
      await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList').update({
        PaidAt:        now,
        PaymentMethod: 'wallet',
        UpdatedDate:   now,
        ...(firstStatus?.ID ? { StatusID: firstStatus.ID } : {}),
      }).eq('OrderNo', orderNo)

      const { data: orderDataFull } = await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList')
        .select('ID').eq('OrderNo', orderNo).single()
      if (orderDataFull) {
        const { data: orderItemsFull } = await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderItemList')
          .select('VariantID, Qty').eq('OrderID', orderDataFull.ID)
        for (const item of orderItemsFull || []) {
          const { data: v } = await supabaseAdmin.schema(dbSchema).from('C_PRD_ProductVariantList')
            .select('StockQty').eq('ID', item.VariantID).single()
          if (v) {
            await supabaseAdmin.schema(dbSchema).from('C_PRD_ProductVariantList')
              .update({ StockQty: Math.max(0, v.StockQty - item.Qty) })
              .eq('ID', item.VariantID)
          }
        }
      }
      return new Response(JSON.stringify({ walletOnly: true, orderNo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const timeStamp = Math.floor(Date.now() / 1000)

    const pad = (n: number) => String(n).padStart(2, '0')

    // ATM 轉帳繳費期限 3 天
    const atmExpire = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const expireDate = `${atmExpire.getFullYear()}${pad(atmExpire.getMonth()+1)}${pad(atmExpire.getDate())}`

    const isCVS = shippingMethodCode === 'cvscom'

    const params: Record<string, string | number> = {
      Amt: newebpayAmount,
      ClientBackURL: `${siteUrl}/orders/${orderNo}`,
      CREDIT: 1,
      LINEPAY: 1,
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
