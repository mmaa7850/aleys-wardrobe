import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function aesEncrypt(plaintext: string, key: string, iv: string): Promise<string> {
  const keyBytes = new Uint8Array(32)
  keyBytes.set(new TextEncoder().encode(key).slice(0, 32))
  const ivBytes = new Uint8Array(16)
  ivBytes.set(new TextEncoder().encode(iv).slice(0, 16))
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivBytes }, cryptoKey, new TextEncoder().encode(plaintext))
  return Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Upper(str: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

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

    const { orderNo } = await req.json()
    if (!orderNo) {
      return new Response(JSON.stringify({ error: 'Missing orderNo' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    const { data: order } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, FinalAmount, NewebpayAmt, WalletDeductAmt, CustomerEmail, OrderNo, ShippingMethod')
      .eq('OrderNo', orderNo)
      .eq('CustomerEmail', user.email)
      .neq('PaymentStatus', 'paid')
      .single()

    if (!order) {
      return new Response(JSON.stringify({ error: '找不到訂單，或此訂單已付款完成' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: orderItems } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderItemList')
      .select('ProductName, VariantID, Qty')
      .eq('OrderID', order.ID)

    for (const item of orderItems || []) {
      const { data: variant } = await supabaseAdmin
        .schema(dbSchema)
        .from('C_PRD_ProductVariantList')
        .select('StockQty')
        .eq('ID', item.VariantID)
        .single()
      if (!variant || variant.StockQty < item.Qty) {
        return new Response(JSON.stringify({ error: `「${item.ProductName}」庫存不足，無法重新付款` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const hashKey    = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV     = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const env        = Deno.env.get('NEWEBPAY_ENV') || 'test'
    const siteUrl    = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'

    const gatewayUrl = env === 'prod'
      ? 'https://core.newebpay.com/MPG/mpg_gateway'
      : 'https://ccore.newebpay.com/MPG/mpg_gateway'

    const timeStamp = Math.floor(Date.now() / 1000)
    const itemDesc  = (orderItems || []).map((i: { ProductName: string }) => i.ProductName).join('、').slice(0, 50)

    // NewebPay bans reusing MerchantOrderNo even on failure.
    // Append _R + single digit (0-9) so the display OrderNo stays unchanged,
    // and payment-notify strips this suffix when looking up the DB record.
    const retrySeq = timeStamp % 10
    const merchantOrderNo = `${orderNo}_R${retrySeq}`

    // NewebpayAmt is the amount already sent to Newebpay at order creation (FinalAmount minus wallet deduction).
    // Retry must use the same figure — wallet was already deducted.
    const retryAmt = order.NewebpayAmt ?? order.FinalAmount

    const pad = (n: number) => String(n).padStart(2, '0')
    const atmExpire = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const expireDate = `${atmExpire.getFullYear()}${pad(atmExpire.getMonth()+1)}${pad(atmExpire.getDate())}`

    const isCVS = order.ShippingMethod === 'cvscom'

    const params: Record<string, string | number> = {
      Amt:             retryAmt,
      ClientBackURL:   `${siteUrl}/orders/${orderNo}`,
      CREDIT:          1,
      CustomerURL:     `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-return`,
      Email:           order.CustomerEmail,
      ExpireDate:      expireDate,
      ItemDesc:        itemDesc || '商品購買',
      MerchantID:      merchantId,
      MerchantOrderNo: merchantOrderNo,
      NotifyURL:       `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-notify`,
      RespondType:     'JSON',
      ReturnURL:       `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-return`,
      TimeStamp:       timeStamp,
      VACC:            1,
      Version:         '2.0',
    }

    if (isCVS) {
      params['CVSCOM'] = 1
      params['LgsType'] = 'C2C'
    }

    const queryStr  = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
    const tradeInfo = await aesEncrypt(queryStr, hashKey, hashIV)
    const tradeSha  = await sha256Upper(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)

    return new Response(JSON.stringify({
      gatewayUrl,
      MerchantID:      merchantId,
      TradeInfo:       tradeInfo,
      TradeSha:        tradeSha,
      TimeStamp:       timeStamp,
      Version:         '2.0',
      MerchantOrderNo: merchantOrderNo,
      DisplayOrderNo:  orderNo,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[retry-payment] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
