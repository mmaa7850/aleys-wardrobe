import { createClient } from '@supabase/supabase-js'
import { createCipheriv } from 'node:crypto'
import { Buffer } from 'node:buffer'

// ── ezPay AES-256-CBC 加密（block=32, no auto-padding）────────────
function ezpayEncrypt(plaintext: string, key: string, iv: string): string {
  const blockSize = 32
  const pad = blockSize - (plaintext.length % blockSize)
  const padded = plaintext + String.fromCharCode(pad).repeat(pad)
  const keyBuf = Buffer.alloc(32); Buffer.from(key, 'utf8').copy(keyBuf, 0, 0, 32)
  const ivBuf  = Buffer.alloc(16); Buffer.from(iv,  'utf8').copy(ivBuf,  0, 0, 16)
  const cipher = createCipheriv('aes-256-cbc', keyBuf, ivBuf)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(Buffer.from(padded, 'utf8')), cipher.final()]).toString('hex')
}

function buildPostData(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
}

async function aesDecrypt(hexStr: string, key: string, iv: string): Promise<string> {
  const k = new Uint8Array(32); k.set(new TextEncoder().encode(key).slice(0, 32))
  const i = new Uint8Array(16); i.set(new TextEncoder().encode(iv).slice(0, 16))
  const enc = new Uint8Array(hexStr.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const ck = await crypto.subtle.importKey('raw', k, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
  const lastC  = enc.slice(-16)
  const target = new Uint8Array(16).map((_, j) => 0x10 ^ lastC[j])
  const fb     = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, ck, target)).slice(0, 16)
  const ext    = new Uint8Array(enc.length + 16); ext.set(enc); ext.set(fb, enc.length)
  const raw    = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: i }, ck, ext))
  return new TextDecoder().decode(raw.slice(0, raw.length - raw[raw.length - 1]))
}

async function sha256Upper(str: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}


Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const hashKey     = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV      = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const ct = req.headers.get('content-type') || ''
    let tradeInfo = '', tradeSha = '', status = ''

    if (ct.includes('application/json')) {
      const body = await req.json()
      tradeInfo = body.TradeInfo ?? ''; tradeSha = body.TradeSha ?? ''; status = body.Status ?? ''
    } else {
      const rawBody = await req.text()
      console.log('[DEBUG] raw body:', rawBody.slice(0, 500))
      const params = new URLSearchParams(rawBody)
      tradeInfo = params.get('TradeInfo') ?? ''; tradeSha = params.get('TradeSha') ?? ''; status = params.get('Status') ?? ''
    }

    if (!tradeInfo || !tradeSha) return new Response('Missing TradeInfo or TradeSha', { status: 400 })

    console.log('[DEBUG] tradeInfo:', tradeInfo.slice(0, 100))
    console.log('[DEBUG] tradeSha (from newebpay):', tradeSha)
    const rawString = `HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`
    console.log('[DEBUG] raw string:', rawString.slice(0, 200))
    const mySha = await sha256Upper(rawString)
    console.log('[DEBUG] mySha:', mySha)

    if (mySha !== tradeSha) { console.error('[payment-notify] TradeSha mismatch'); return new Response('Invalid signature', { status: 400 }) }

    const decrypted = await aesDecrypt(tradeInfo, hashKey, hashIV)
    let result: Record<string, string> = {}
    try { const p = JSON.parse(decrypted); result = { ...p, ...(p.Result || {}) } } catch { result = Object.fromEntries(new URLSearchParams(decrypted)) }

    // Strip retry suffix (e.g. AW_20260503_12345_R3 → AW_20260503_12345)
    const orderNo  = (result.MerchantOrderNo || '').replace(/_R\d+$/, '')
    const payStatus = (status === 'SUCCESS' || result.Status === 'SUCCESS') ? 'paid' : 'failed'

    if (!orderNo) { console.error('[payment-notify] No MerchantOrderNo:', result); return new Response('Missing order number', { status: 400 }) }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    console.log('[payment-notify] orderNo:', orderNo, '| payStatus:', payStatus)

    // 冪等檢查：已經 paid 就不重複處理
    const { data: existingOrder } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
      .select('PaymentStatus')
      .eq('OrderNo', orderNo)
      .single()

    if (existingOrder?.PaymentStatus === 'paid') {
      console.log('[payment-notify] Already paid, skipping duplicate notify')
      return new Response('OK', { status: 200 })
    }

    // 更新付款狀態、藍新交易序號、付款方式
    const baseUpdate: Record<string, string | null> = {
      PaymentStatus: payStatus,
      UpdatedDate: new Date().toISOString(),
    }
    if (result.TradeNo)     baseUpdate.TradeNo      = result.TradeNo
    if (result.PaymentType) baseUpdate.PaymentMethod = result.PaymentType

    const { error: updateErr } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
      .update(baseUpdate)
      .eq('OrderNo', orderNo)
    if (updateErr) console.error('[payment-notify] PaymentStatus update error:', updateErr.message)
    else console.log('[payment-notify] PaymentStatus updated to', payStatus, '| TradeNo:', result.TradeNo, '| PaymentType:', result.PaymentType)

    if (payStatus === 'paid') {
      // 查詢完整訂單資料
      const { data: orderData, error: orderFetchErr } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
        .select('ID, ShippingName, CustomerPhone, CustomerEmail, CustomerName, FinalAmount, ShippingFee, StoreID, ShippingMethod, WalletDeductAmt, NewebpayAmt, InvoiceStatus, InvoiceCarrierType, InvoiceCarrierNum, InvoiceLoveCode, InvoiceBuyerUBN, InvoiceBuyerName')
        .eq('OrderNo', orderNo)
        .single()

      if (orderFetchErr || !orderData) {
        console.error('[payment-notify] Order not found for orderNo:', orderNo, orderFetchErr?.message)
      } else {
        console.log('[payment-notify] Order found, ID:', orderData.ID)

        // 扣除庫存
        const { data: orderItems, error: itemsErr } = await supabase.schema(dbSchema).from('C_ORD_OrderItemList')
          .select('VariantID, Qty').eq('OrderID', orderData.ID)
        if (itemsErr) console.error('[payment-notify] OrderItems fetch error:', itemsErr.message)
        console.log('[payment-notify] Items to deduct:', orderItems?.length ?? 0)

        for (const item of orderItems || []) {
          const { data: variant, error: variantErr } = await supabase.schema(dbSchema).from('C_PRD_ProductVariantList')
            .select('StockQty').eq('ID', item.VariantID).single()
          if (variantErr || !variant) {
            console.error('[payment-notify] Variant not found:', item.VariantID, variantErr?.message)
            continue
          }
          const newQty = Math.max(0, variant.StockQty - item.Qty)
          const { error: stockErr } = await supabase.schema(dbSchema).from('C_PRD_ProductVariantList')
            .update({ StockQty: newQty })
            .eq('ID', item.VariantID)
          if (stockErr) console.error('[payment-notify] Stock update error variant', item.VariantID, stockErr.message)
          else console.log(`[payment-notify] Stock deducted: variant ${item.VariantID} ${variant.StockQty} → ${newQty}`)
        }

        // 儲存藍新 CVSCOM 回傳的物流資訊
        const storeCode = result.StoreCode || ''
        const lgsNo     = result.LgsNo     || ''
        if (storeCode || lgsNo) {
          const lgsUpdate: Record<string, string | null> = {
            ShippingStatus:     '0_1',
            ShippingStatusText: '訂單未處理',
            UpdatedDate:        new Date().toISOString(),
          }
          if (storeCode)           lgsUpdate.StoreID         = storeCode
          if (result.StoreName)    lgsUpdate.StoreName       = result.StoreName
          if (result.StoreAddr)    lgsUpdate.ShippingAddress = result.StoreAddr
          if (result.CVSCOMName)   lgsUpdate.ShippingName    = result.CVSCOMName
          if (result.CVSCOMPhone)  lgsUpdate.ShippingPhone   = result.CVSCOMPhone
          if (lgsNo)               lgsUpdate.LgsNo           = lgsNo

          const { error: lgsErr } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
            .update(lgsUpdate)
            .eq('OrderNo', orderNo)
          if (lgsErr) console.error('[payment-notify] CVSCOM update error:', lgsErr.message)
          else console.log('[payment-notify] CVSCOM store info saved:', storeCode, lgsNo)
        }

        // ── 自動開立 ezPay 電子發票 ─────────────────────────────────
        // 全額錢包付款（NewebpayAmt=0）不開立，儲值時已開過
        const newebpayAmt = orderData.NewebpayAmt ?? 0
        const invoiceAlreadyIssued = orderData.InvoiceStatus && orderData.InvoiceStatus !== 'none'
        if (newebpayAmt > 0 && !invoiceAlreadyIssued) {
          try {
            const merchantId = Deno.env.get('EZPAY_MERCHANT_ID')!
            const ezKey      = Deno.env.get('EZPAY_HASH_KEY')!.trim()
            const ezIV       = Deno.env.get('EZPAY_HASH_IV')!.trim()
            const ezEnv      = Deno.env.get('EZPAY_ENV') || 'test'
            const baseUrl    = ezEnv === 'prod' ? 'https://inv.ezpay.com.tw' : 'https://cinv.ezpay.com.tw'

            const isB2B      = orderData.InvoiceCarrierType === 'B2B'
            const isDonate   = orderData.InvoiceCarrierType === 'D'
            const hasCarrier = ['0', '1', '2'].includes(orderData.InvoiceCarrierType ?? '')

            const totalAmt     = newebpayAmt
            const shippingFee  = orderData.ShippingFee || 0
            // 若混合付款，運費按比例分配到藍新部分
            const walletDeduct = orderData.WalletDeductAmt ?? 0
            const finalAmount  = orderData.FinalAmount ?? totalAmt
            const shippingInNewebpay = walletDeduct > 0
              ? Math.round(shippingFee * (newebpayAmt / finalAmount))
              : shippingFee
            const goodsAmt  = totalAmt - shippingInNewebpay
            const taxAmt    = totalAmt - Math.round(totalAmt / 1.05)
            const saleAmt   = totalAmt - taxAmt

            const itemNames:  string[] = ['商品費用']
            const itemCounts: string[] = ['1']
            const itemUnits:  string[] = ['式']
            const itemPrices: string[] = [String(goodsAmt)]
            const itemAmts:   string[] = [String(goodsAmt)]
            if (shippingInNewebpay > 0) {
              itemNames.push('運費'); itemCounts.push('1'); itemUnits.push('式')
              itemPrices.push(String(shippingInNewebpay)); itemAmts.push(String(shippingInNewebpay))
            }

            const invoiceParams: Record<string, string> = {
              RespondType:     'JSON',
              Version:         '1.5',
              TimeStamp:       String(Math.floor(Date.now() / 1000)),
              MerchantOrderNo: orderNo,
              Status:          '1',
              Category:        isB2B ? 'B2B' : 'B2C',
              BuyerName:       isB2B ? (orderData.InvoiceBuyerName || orderData.CustomerName || '公司') : (orderData.CustomerName || '消費者'),
              PrintFlag:       (hasCarrier || isDonate) ? 'N' : 'Y',
              TaxType:         '1',
              TaxRate:         '5',
              Amt:             String(saleAmt),
              TaxAmt:          String(taxAmt),
              TotalAmt:        String(totalAmt),
              ItemName:        itemNames.join('|'),
              ItemCount:       itemCounts.join('|'),
              ItemUnit:        itemUnits.join('|'),
              ItemPrice:       isB2B ? itemPrices.map(p => String(Math.round(Number(p) / 1.05))).join('|') : itemPrices.join('|'),
              ItemAmt:         isB2B ? itemAmts.map(a => String(Math.round(Number(a) / 1.05))).join('|')   : itemAmts.join('|'),
            }
            if (orderData.CustomerEmail)                        invoiceParams.BuyerEmail  = orderData.CustomerEmail
            if (isB2B && orderData.InvoiceBuyerUBN)            invoiceParams.BuyerUBN    = orderData.InvoiceBuyerUBN
            if (hasCarrier && orderData.InvoiceCarrierNum)      { invoiceParams.CarrierType = orderData.InvoiceCarrierType!; invoiceParams.CarrierNum = encodeURIComponent(orderData.InvoiceCarrierNum) }
            if (isDonate && orderData.InvoiceLoveCode)          invoiceParams.LoveCode    = orderData.InvoiceLoveCode

            const postData = ezpayEncrypt(buildPostData(invoiceParams), ezKey, ezIV)
            const res = await fetch(`${baseUrl}/Api/invoice_issue`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ MerchantID_: merchantId, PostData_: postData }).toString(),
            })
            const text = await res.text()
            console.log('[payment-notify] ezPay invoice raw:', text.slice(0, 300))
            let apiData: Record<string, unknown> = {}
            try { apiData = JSON.parse(text) } catch { apiData = Object.fromEntries(new URLSearchParams(text)) }

            if (apiData.Status === 'SUCCESS') {
              const raw = apiData.Result
              const r: Record<string, string> = typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, string>
              await supabase.schema(dbSchema).from('C_ORD_OrderList').update({
                InvoiceStatus:    'issued',
                InvoiceNo:        r.InvoiceTransNo,
                InvoiceNumber:    r.InvoiceNumber,
                InvoiceRandomNum: r.RandomNum,
                InvoiceIssuedAt:  new Date().toISOString(),
                UpdatedDate:      new Date().toISOString(),
              }).eq('OrderNo', orderNo)
              console.log('[payment-notify] Invoice issued:', r.InvoiceNumber)
            } else {
              console.warn('[payment-notify] Invoice failed:', apiData.Message || apiData.Status)
            }
          } catch (invErr) {
            console.warn('[payment-notify] Invoice error (non-fatal):', invErr instanceof Error ? invErr.message : invErr)
          }
        } else if (newebpayAmt === 0) {
          console.log('[payment-notify] Full wallet order, skipping invoice:', orderNo)
        }
      }
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[payment-notify] error:', err instanceof Error ? err.message : err)
    return new Response('Internal error', { status: 500 })
  }
})
