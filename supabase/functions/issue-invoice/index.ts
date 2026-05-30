import { createClient } from '@supabase/supabase-js'
import { createCipheriv } from 'node:crypto'
import { Buffer } from 'node:buffer'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ezPay 要求 AES-256-CBC + PKCS#7 padding (block=32) + no auto-padding
function ezpayEncrypt(plaintext: string, key: string, iv: string): string {
  const blockSize = 32
  const pad = blockSize - (plaintext.length % blockSize)
  const padded = plaintext + String.fromCharCode(pad).repeat(pad)

  const keyBuf = Buffer.alloc(32)
  Buffer.from(key, 'utf8').copy(keyBuf, 0, 0, 32)
  const ivBuf = Buffer.alloc(16)
  Buffer.from(iv, 'utf8').copy(ivBuf, 0, 0, 16)

  const cipher = createCipheriv('aes-256-cbc', keyBuf, ivBuf)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(Buffer.from(padded, 'utf8')), cipher.final()]).toString('hex')
}

function buildPostData(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    const { data: adminUser } = await supabaseAdmin
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive')
      .eq('UserId', user.id)
      .single()

    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    const { action, orderNo, allowanceAmt } = await req.json()
    if (!action || !orderNo) return json({ error: '缺少必要參數' }, 400)

    const { data: order, error: orderErr } = await supabaseAdmin
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .select('ID, OrderNo, FinalAmount, ShippingFee, PaymentStatus, CustomerName, CustomerEmail, InvoiceStatus, InvoiceNo, InvoiceNumber, InvoiceRandomNum, InvoiceCarrierType, InvoiceCarrierNum, InvoiceLoveCode, InvoiceBuyerUBN, InvoiceBuyerName')
      .eq('OrderNo', orderNo)
      .single()

    if (orderErr || !order) return json({ error: '找不到訂單' }, 404)

    const merchantId = Deno.env.get('EZPAY_MERCHANT_ID')!
    const hashKey   = Deno.env.get('EZPAY_HASH_KEY')!.trim()
    const hashIV    = Deno.env.get('EZPAY_HASH_IV')!.trim()
    const env       = Deno.env.get('EZPAY_ENV') || 'test'
    const baseUrl   = env === 'prod' ? 'https://inv.ezpay.com.tw' : 'https://cinv.ezpay.com.tw'

    async function callEzpay(endpoint: string, params: Record<string, string>) {
      const postData = ezpayEncrypt(buildPostData(params), hashKey, hashIV)
      const res = await fetch(`${baseUrl}/Api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ MerchantID_: merchantId, PostData_: postData }).toString(),
      })
      const text = await res.text()
      console.log(`[issue-invoice] ${endpoint} raw:`, text.slice(0, 500))
      try { return JSON.parse(text) } catch { return Object.fromEntries(new URLSearchParams(text)) }
    }

    // ── 開立發票 ──────────────────────────────────────────────────────────
    if (action === 'issue') {
      if (order.PaymentStatus !== 'paid') return json({ error: '訂單非付款狀態，無法開立發票' }, 400)
      if (order.InvoiceStatus && order.InvoiceStatus !== 'none') return json({ error: '此訂單已有發票記錄' }, 400)

      const totalAmt   = order.FinalAmount
      const shippingFee = order.ShippingFee || 0
      const goodsAmt   = totalAmt - shippingFee

      // B2C 含稅單價，以 5% 計算銷售額與稅額
      const amt    = Math.round(totalAmt / 1.05)
      const taxAmt = totalAmt - amt

      const itemNames:  string[] = ['商品費用']
      const itemCounts: string[] = ['1']
      const itemUnits:  string[] = ['式']
      const itemPrices: string[] = [String(goodsAmt)]
      const itemAmts:   string[] = [String(goodsAmt)]

      if (shippingFee > 0) {
        itemNames.push('運費')
        itemCounts.push('1')
        itemUnits.push('式')
        itemPrices.push(String(shippingFee))
        itemAmts.push(String(shippingFee))
      }

      const carrierType: string = (order as any).InvoiceCarrierType || ''
      const isB2B      = carrierType === 'B2B'
      const isDonate   = carrierType === 'D'

      const params: Record<string, string> = {
        RespondType:     'JSON',
        Version:         '1.5',
        TimeStamp:       String(Math.floor(Date.now() / 1000)),
        MerchantOrderNo: order.OrderNo,
        Status:          '1',
        Category:        isB2B ? 'B2B' : 'B2C',
        BuyerName:       isB2B ? ((order as any).InvoiceBuyerName || order.CustomerName || '公司') : (order.CustomerName || '消費者'),
        PrintFlag:       isDonate ? 'N' : 'Y',   // 捐贈發票不需列印
        TaxType:         '1',
        TaxRate:         '5',
        Amt:             String(amt),
        TaxAmt:          String(taxAmt),
        TotalAmt:        String(totalAmt),
        ItemName:        itemNames.join('|'),
        ItemCount:       itemCounts.join('|'),
        ItemUnit:        itemUnits.join('|'),
        ItemPrice:       itemPrices.join('|'),
        ItemAmt:         itemAmts.join('|'),
      }

      // 公司戶三聯式：加統一編號
      if (isB2B && (order as any).InvoiceBuyerUBN) {
        params.BuyerUBN = (order as any).InvoiceBuyerUBN
      }

      // 手機條碼（CarrierType=1）
      if (carrierType === '0' && (order as any).InvoiceCarrierNum) {
        params.CarrierType = '1'
        params.CarrierNum  = (order as any).InvoiceCarrierNum
      }

      // 自然人憑證（CarrierType=2，MOICA）
      if (carrierType === '1' && (order as any).InvoiceCarrierNum) {
        params.CarrierType = '2'
        params.CarrierNum  = (order as any).InvoiceCarrierNum
      }

      // 捐贈碼
      if (isDonate && (order as any).InvoiceLoveCode) {
        params.LoveCode = (order as any).InvoiceLoveCode
      }

      if (order.CustomerEmail) params.BuyerEmail = order.CustomerEmail

      const apiData = await callEzpay('invoice_issue', params)
      if (apiData.Status !== 'SUCCESS') return json({ error: `發票開立失敗：${apiData.Message || apiData.Status}` }, 400)

      const r = apiData.Result as Record<string, string>
      await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList').update({
        InvoiceStatus:    'issued',
        InvoiceNo:        r.InvoiceTransNo,
        InvoiceNumber:    r.InvoiceNumber,
        InvoiceRandomNum: r.RandomNum,
        InvoiceIssuedAt:  new Date().toISOString(),
        UpdatedDate:      new Date().toISOString(),
      }).eq('OrderNo', orderNo)

      return json({ success: true, invoiceNumber: r.InvoiceNumber, invoiceNo: r.InvoiceTransNo, randomNum: r.RandomNum })
    }

    // ── 作廢發票 ──────────────────────────────────────────────────────────
    if (action === 'void') {
      if (order.InvoiceStatus !== 'issued') return json({ error: '發票狀態非已開立，無法作廢' }, 400)
      if (!order.InvoiceNumber) return json({ error: '找不到發票號碼' }, 400)

      const apiData = await callEzpay('invoice_invalid', {
        RespondType:   'JSON',
        Version:       '1.0',
        TimeStamp:     String(Math.floor(Date.now() / 1000)),
        InvoiceNumber: order.InvoiceNumber,
        InvalidReason: '訂單退款',
      })
      if (apiData.Status !== 'SUCCESS') return json({ error: `發票作廢失敗：${apiData.Message || apiData.Status}` }, 400)

      await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList').update({
        InvoiceStatus: 'voided',
        UpdatedDate:   new Date().toISOString(),
      }).eq('OrderNo', orderNo)

      return json({ success: true })
    }

    // ── 開立折讓 ──────────────────────────────────────────────────────────
    if (action === 'allowance') {
      if (order.InvoiceStatus !== 'issued') return json({ error: '發票狀態非已開立，無法開立折讓' }, 400)
      if (!order.InvoiceNumber) return json({ error: '找不到發票號碼' }, 400)
      if (!allowanceAmt || Number(allowanceAmt) <= 0) return json({ error: '請填寫折讓金額' }, 400)

      const amt = Number(allowanceAmt)
      const params: Record<string, string> = {
        RespondType:     'JSON',
        Version:         '1.3',
        TimeStamp:       String(Math.floor(Date.now() / 1000)),
        InvoiceNo:       order.InvoiceNumber,
        MerchantOrderNo: order.OrderNo,
        ItemName:        '退款折讓',
        ItemCount:       '1',
        ItemUnit:        '式',
        ItemPrice:       String(amt),
        ItemAmt:         String(amt),
        ItemTaxAmt:      '0',
        TotalAmt:        String(amt),
        Status:          '1',
      }
      if (order.CustomerEmail) params.BuyerEmail = order.CustomerEmail

      const apiData = await callEzpay('allowance_issue', params)
      if (apiData.Status !== 'SUCCESS') return json({ error: `折讓開立失敗：${apiData.Message || apiData.Status}` }, 400)

      const r = apiData.Result as Record<string, string>
      await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList').update({
        InvoiceStatus:       'allowance',
        InvoiceAllowanceNo:  r.AllowanceNo,
        InvoiceAllowanceAmt: amt,
        UpdatedDate:         new Date().toISOString(),
      }).eq('OrderNo', orderNo)

      return json({ success: true, allowanceNo: r.AllowanceNo })
    }

    return json({ error: '不支援的 action' }, 400)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[issue-invoice] error:', msg)
    return json({ error: msg }, 500)
  }
})
