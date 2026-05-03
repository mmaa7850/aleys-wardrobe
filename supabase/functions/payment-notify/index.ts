import { createClient } from '@supabase/supabase-js'

async function aesEncrypt(text: string, key: string, iv: string): Promise<string> {
  const k = new Uint8Array(32); k.set(new TextEncoder().encode(key).slice(0, 32))
  const i = new Uint8Array(16); i.set(new TextEncoder().encode(iv).slice(0, 16))
  const ck = await crypto.subtle.importKey('raw', k, { name: 'AES-CBC' }, false, ['encrypt'])
  const enc = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: i }, ck, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(enc)).map(b => b.toString(16).padStart(2, '0')).join('')
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

// 呼叫藍新物流 API (Form POST)
async function callLogisticsApi(apiUrl: string, innerParams: string, merchantId: string, hashKey: string, hashIV: string): Promise<Record<string, unknown>> {
  const encryptData = await aesEncrypt(innerParams, hashKey, hashIV)
  const hashData    = await sha256Upper(`HashKey=${hashKey}&${encryptData}&HashIV=${hashIV}`)

  const form = new URLSearchParams({
    UID_:          merchantId,
    EncryptData_:  encryptData,
    HashData_:     hashData,
    Version_:      '1.0',
    RespondType_:  'JSON',
  })

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    form.toString(),
  })
  return res.json()
}

// 解密藍新物流 API 回傳的 EncryptData
async function decryptLogisticsResponse(json: Record<string, unknown>, hashKey: string, hashIV: string): Promise<Record<string, unknown>> {
  const encryptData = (json.EncryptData as string) || ''
  if (!encryptData) throw new Error(`Logistics API error: ${json.Message}`)
  const plain = await aesDecrypt(encryptData, hashKey, hashIV)
  try { return JSON.parse(plain) } catch { return Object.fromEntries(new URLSearchParams(plain)) }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const hashKey    = Deno.env.get('NEWEBPAY_HASH_KEY')!
    const hashIV     = Deno.env.get('NEWEBPAY_HASH_IV')!
    const lgsHashKey = Deno.env.get('NEWEBPAY_LGS_HASH_KEY') || hashKey
    const lgsHashIV  = Deno.env.get('NEWEBPAY_LGS_HASH_IV')  || hashIV
    const merchantId = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const env        = Deno.env.get('NEWEBPAY_ENV') || 'test'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const lgsBase = env === 'prod'
      ? 'https://core.newebpay.com/API/Logistic'
      : 'https://ccore.newebpay.com/API/Logistic'

    const ct = req.headers.get('content-type') || ''
    let tradeInfo = '', tradeSha = '', status = ''

    if (ct.includes('application/json')) {
      const body = await req.json()
      tradeInfo = body.TradeInfo ?? ''; tradeSha = body.TradeSha ?? ''; status = body.Status ?? ''
    } else {
      const params = new URLSearchParams(await req.text())
      tradeInfo = params.get('TradeInfo') ?? ''; tradeSha = params.get('TradeSha') ?? ''; status = params.get('Status') ?? ''
    }

    if (!tradeInfo || !tradeSha) return new Response('Missing TradeInfo or TradeSha', { status: 400 })

    const expectedSha = await sha256Upper(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)
    if (expectedSha !== tradeSha) { console.error('[payment-notify] TradeSha mismatch'); return new Response('Invalid signature', { status: 400 }) }

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

    // 更新付款狀態
    const { error: updateErr } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
      .update({ PaymentStatus: payStatus, UpdatedDate: new Date().toISOString() })
      .eq('OrderNo', orderNo)
    if (updateErr) console.error('[payment-notify] PaymentStatus update error:', updateErr.message)
    else console.log('[payment-notify] PaymentStatus updated to', payStatus)

    if (payStatus === 'paid') {
      // 查詢完整訂單資料
      const { data: orderData, error: orderFetchErr } = await supabase.schema(dbSchema).from('C_ORD_OrderList')
        .select('ID, ShippingName, CustomerPhone, CustomerEmail, FinalAmount, StoreID, ShippingMethod')
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

        // 建立物流訂單（7-11 取貨不付款）
        if (orderData.ShippingMethod === 'cvs_711' && orderData.StoreID) {
          try {
            const ts = Math.floor(Date.now() / 1000)

            // NPA-B52：建立物流寄貨單
            const b52Params = [
              `MerchantOrderNo=${orderNo}`,
              `TradeType=3`,
              `UserName=${orderData.ShippingName}`,
              `UserTel=${orderData.CustomerPhone}`,
              `UserEmail=${orderData.CustomerEmail}`,
              `StoreID=${orderData.StoreID}`,
              `Amt=${orderData.FinalAmount}`,
              `LgsType=C2C`,
              `ShipType=1`,
              `TimeStamp=${ts}`,
              `NotifyURL=${supabaseUrl}/functions/v1/logistics-notify`,
              `ItemDesc=商品`,
            ].join('&')

            const b52Res = await callLogisticsApi(`${lgsBase}/createShipment`, b52Params, merchantId, lgsHashKey, lgsHashIV)
            console.log('[payment-notify] NPA-B52 status:', b52Res.Status, b52Res.Message)

            if (b52Res.Status === 'SUCCESS') {
              const b52Data = await decryptLogisticsResponse(b52Res as Record<string, unknown>, lgsHashKey, lgsHashIV)
              const logisticsTradeNo = b52Data.TradeNo as string || ''

              // NPA-B53：取得寄件代碼
              const ts2 = Math.floor(Date.now() / 1000)
              const b53Params = `MerchantOrderNo=["${orderNo}"]&TimeStamp=${ts2}`
              const b53Res = await callLogisticsApi(`${lgsBase}/getShipmentNo`, b53Params, merchantId, lgsHashKey, lgsHashIV)
              console.log('[payment-notify] NPA-B53 status:', b53Res.Status, b53Res.Message)

              let lgsNo = '', storePrintNo = ''
              if (b53Res.Status === 'SUCCESS') {
                const b53Data = await decryptLogisticsResponse(b53Res as Record<string, unknown>, lgsHashKey, lgsHashIV)
                const successList = (b53Data.SUCCESS as Array<Record<string, string>>) || []
                if (successList.length > 0) {
                  lgsNo        = successList[0].LgsNo        || ''
                  storePrintNo = successList[0].StorePrintNo || ''
                }
              }

              // 回寫物流資料到訂單
              await supabase.schema(dbSchema).from('C_ORD_OrderList').update({
                LogisticsTradeNo:  logisticsTradeNo,
                LgsNo:             lgsNo,
                StorePrintNo:      storePrintNo,
                ShippingStatus:    '0_1',
                ShippingStatusText: '訂單未處理',
                UpdatedDate:       new Date().toISOString(),
              }).eq('OrderNo', orderNo)
            } else {
              console.error('[payment-notify] NPA-B52 failed:', b52Res.Message)
            }
          } catch (lgsErr) {
            console.error('[payment-notify] Logistics error:', lgsErr instanceof Error ? lgsErr.message : lgsErr)
          }
        }
      }
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[payment-notify] error:', err instanceof Error ? err.message : err)
    return new Response('Internal error', { status: 500 })
  }
})
