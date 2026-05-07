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

// 信用卡類付款方式（可走 NPA-B032 API 退款）
const CREDIT_PAYMENT_TYPES = new Set(['CREDIT', 'APPLEPAY', 'GOOGLEPAY', 'SAMSUNGPAY', 'WEBATM', 'UNIONPAY', 'CREDITAE', 'FOREIGN'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // 驗證使用者
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 驗證管理員
    const { data: adminUser } = await supabaseAdmin
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive')
      .eq('UserId', user.id)
      .single()

    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    const { orderNo, manual = false } = await req.json()
    if (!orderNo) return json({ error: '缺少 orderNo' }, 400)

    // 查詢訂單
    const { data: order, error: orderErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, OrderNo, FinalAmount, PaymentStatus, PaymentMethod, TradeNo')
      .eq('OrderNo', orderNo)
      .single()

    if (orderErr || !order) return json({ error: '找不到訂單' }, 404)
    if (order.PaymentStatus === 'refunded') return json({ error: '此訂單已退款' }, 400)
    if (order.PaymentStatus !== 'paid') return json({ error: '此訂單非已付款狀態，無法退款' }, 400)

    const isCreditCard = !order.PaymentMethod || CREDIT_PAYMENT_TYPES.has(order.PaymentMethod)

    // ATM 或手動模式：直接更新 DB，不呼叫藍新 API
    if (!isCreditCard || manual) {
      const { error: updateErr } = await supabaseAdmin
        .schema(dbSchema)
        .from('C_ORD_OrderList')
        .update({ PaymentStatus: 'refunded', UpdatedDate: new Date().toISOString() })
        .eq('OrderNo', orderNo)

      if (updateErr) throw new Error(updateErr.message)
      console.log('[refund-payment] Manual refund marked for order:', orderNo)
      return json({ success: true, method: 'manual' })
    }

    // 信用卡：呼叫藍新 NPA-B032 退款 API
    const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const hashKey    = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV     = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const env        = Deno.env.get('NEWEBPAY_ENV') || 'test'

    const closeUrl = env === 'prod'
      ? 'https://core.newebpay.com/API/CreditCard/Close'
      : 'https://ccore.newebpay.com/API/CreditCard/Close'

    // 有 TradeNo 用 IndexType=2，否則用 MerchantOrderNo (IndexType=1)
    const useTradeNo = !!order.TradeNo
    const innerParams: Record<string, string> = {
      RespondType: 'JSON',
      Version:     '1.1',
      TimeStamp:   String(Math.floor(Date.now() / 1000)),
      Amt:         String(order.FinalAmount),
      MerchantOrderNo: order.OrderNo,
      IndexType:   useTradeNo ? '2' : '1',
      CloseType:   '2', // 退款
    }
    if (useTradeNo) innerParams.TradeNo = order.TradeNo

    const postDataPlain = Object.entries(innerParams).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    const postData = await aesEncrypt(postDataPlain, hashKey, hashIV)

    console.log('[refund-payment] Calling NewebPay Close API for order:', orderNo, '| IndexType:', innerParams.IndexType)

    const apiRes = await fetch(closeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ MerchantID_: merchantId, PostData_: postData }).toString(),
    })

    const apiText = await apiRes.text()
    console.log('[refund-payment] NewebPay raw response:', apiText.slice(0, 500))

    let apiData: Record<string, unknown> = {}
    try { apiData = JSON.parse(apiText) } catch { apiData = Object.fromEntries(new URLSearchParams(apiText)) }

    if (apiData.Status !== 'SUCCESS') {
      const msg = (apiData.Message as string) || String(apiData.Status) || '未知錯誤'
      console.error('[refund-payment] NewebPay refund failed:', msg)
      return json({ error: `藍新退款失敗：${msg}` }, 400)
    }

    // 退款成功，更新 DB
    const { error: updateErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .update({ PaymentStatus: 'refunded', UpdatedDate: new Date().toISOString() })
      .eq('OrderNo', orderNo)

    if (updateErr) throw new Error(updateErr.message)
    console.log('[refund-payment] Refund success for order:', orderNo)

    return json({ success: true, method: 'api', newebpay: apiData })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[refund-payment] error:', msg)
    return json({ error: msg }, 500)
  }
})
