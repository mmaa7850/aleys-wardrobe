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

    const body = await req.json()
    const { amount, invoiceCarrierType = null, invoiceCarrierNum = null, invoiceLoveCode = null, invoiceBuyerUBN = null } = body

    const amt = Number(amount)
    if (!amt || amt < 1 || !Number.isInteger(amt)) return json({ error: '請填寫有效的儲值金額（正整數）' }, 400)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 載入會員 Email
    const { data: memberData } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_MBR_MemberList')
      .select('Name, Phone')
      .eq('UserID', user.id)
      .maybeSingle()

    // 產生儲值單號 TU_YYYYMMDD_XXXXX
    const now = new Date()
    const dateStr = now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    const topupNo = `TU_${dateStr}_${rand}`

    // 建立儲值訂單
    const { error: insertErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_MBR_WalletTopupList')
      .insert({
        TopupNo:            topupNo,
        UserID:             user.id,
        Amount:             amt,
        PaymentStatus:      'pending',
        InvoiceStatus:      'none',
        InvoiceCarrierType: invoiceCarrierType,
        InvoiceCarrierNum:  ['0', '1', '2'].includes(invoiceCarrierType) ? invoiceCarrierNum : null,
        InvoiceLoveCode:    invoiceCarrierType === 'D'   ? invoiceLoveCode  : null,
        InvoiceBuyerUBN:    invoiceCarrierType === 'B2B' ? invoiceBuyerUBN  : null,
      })
    if (insertErr) throw new Error(`Topup insert failed: ${insertErr.message}`)

    // 建立藍新付款參數
    const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const hashKey    = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV     = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const env        = Deno.env.get('NEWEBPAY_ENV') || 'test'
    const siteUrl    = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const gatewayUrl = env === 'prod'
      ? 'https://core.newebpay.com/MPG/mpg_gateway'
      : 'https://ccore.newebpay.com/MPG/mpg_gateway'

    const timeStamp = Math.floor(Date.now() / 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const atmExpire = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const expireDate = `${atmExpire.getFullYear()}${pad(atmExpire.getMonth()+1)}${pad(atmExpire.getDate())}`

    const params: Record<string, string | number> = {
      Amt:             amt,
      ClientBackURL:   `${siteUrl}/wallet`,
      CREDIT:          1,
      CustomerURL:     `${supabaseUrl}/functions/v1/wallet-topup-return`,
      Email:           user.email ?? '',
      ExpireDate:      expireDate,
      ItemDesc:        `錢包儲值 NT$${amt}`,
      LINEPAY:         1,
      MerchantID:      merchantId,
      MerchantOrderNo: topupNo,
      NotifyURL:       `${supabaseUrl}/functions/v1/wallet-topup-notify`,
      RespondType:     'JSON',
      ReturnURL:       `${supabaseUrl}/functions/v1/wallet-topup-return`,
      TimeStamp:       timeStamp,
      VACC:            1,
      Version:         '2.0',
    }

    const sortedKeys = Object.keys(params).sort()
    const queryStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
    const tradeInfo = await aesEncrypt(queryStr, hashKey, hashIV)
    const tradeSha  = await sha256Upper(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)

    return json({
      gatewayUrl,
      MerchantID:      merchantId,
      TradeInfo:       tradeInfo,
      TradeSha:        tradeSha,
      TimeStamp:       timeStamp,
      Version:         '2.0',
      MerchantOrderNo: topupNo,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[wallet-topup] error:', msg)
    return json({ error: msg }, 500)
  }
})
