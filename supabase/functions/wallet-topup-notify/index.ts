import { createClient } from '@supabase/supabase-js'
import { createCipheriv } from 'node:crypto'
import { Buffer } from 'node:buffer'
// deployed: 2026-05-18

// ── AES 解密（藍新）──────────────────────────────────────────
async function aesDecrypt(hexStr: string, key: string, iv: string): Promise<string> {
  const k = new Uint8Array(32); k.set(new TextEncoder().encode(key).slice(0, 32))
  const i = new Uint8Array(16); i.set(new TextEncoder().encode(iv).slice(0, 16))
  const enc = new Uint8Array(hexStr.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const ck = await crypto.subtle.importKey('raw', k, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
  const lastC = enc.slice(-16)
  const target = new Uint8Array(16).map((_, j) => 0x10 ^ lastC[j])
  const fb  = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, ck, target)).slice(0, 16)
  const ext = new Uint8Array(enc.length + 16); ext.set(enc); ext.set(fb, enc.length)
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: i }, ck, ext))
  return new TextDecoder().decode(raw.slice(0, raw.length - raw[raw.length - 1]))
}

async function sha256Upper(str: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── ezPay AES-256-CBC（block=32, no auto-padding）────────────
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
      const params = new URLSearchParams(await req.text())
      tradeInfo = params.get('TradeInfo') ?? ''; tradeSha = params.get('TradeSha') ?? ''; status = params.get('Status') ?? ''
    }

    if (!tradeInfo || !tradeSha) return new Response('Missing TradeInfo or TradeSha', { status: 400 })

    const mySha = await sha256Upper(`HashKey=${hashKey}&${tradeInfo}&HashIV=${hashIV}`)
    if (mySha !== tradeSha) {
      console.error('[wallet-topup-notify] TradeSha mismatch')
      return new Response('Invalid signature', { status: 400 })
    }

    const decrypted = await aesDecrypt(tradeInfo, hashKey, hashIV)
    let result: Record<string, string> = {}
    try { const p = JSON.parse(decrypted); result = { ...p, ...(p.Result || {}) } }
    catch { result = Object.fromEntries(new URLSearchParams(decrypted)) }

    const topupNo  = result.MerchantOrderNo || ''
    const payStatus = (status === 'SUCCESS' || result.Status === 'SUCCESS') ? 'paid' : 'failed'

    if (!topupNo) {
      console.error('[wallet-topup-notify] No MerchantOrderNo:', result)
      return new Response('Missing order number', { status: 400 })
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 冪等：已處理就跳過
    const { data: existing } = await supabase.schema(dbSchema).from('C_MBR_WalletTopupList')
      .select('PaymentStatus, MemberID, Amount, InvoiceStatus, InvoiceCarrierType, InvoiceCarrierNum, InvoiceLoveCode, InvoiceBuyerUBN')
      .eq('TopupNo', topupNo)
      .single()

    if (!existing) {
      console.error('[wallet-topup-notify] TopupNo not found:', topupNo)
      return new Response('Topup not found', { status: 404 })
    }
    if (existing.PaymentStatus === 'paid') {
      console.log('[wallet-topup-notify] Already paid, skipping:', topupNo)
      return new Response('OK', { status: 200 })
    }

    // 更新付款狀態
    await supabase.schema(dbSchema).from('C_MBR_WalletTopupList').update({
      PaymentStatus: payStatus,
      TradeNo:       result.TradeNo     || null,
      PaymentMethod: result.PaymentType || null,
      PaidAt:        payStatus === 'paid' ? new Date().toISOString() : null,
      UpdatedDate:   new Date().toISOString(),
    }).eq('TopupNo', topupNo)

    if (payStatus !== 'paid') {
      console.log('[wallet-topup-notify] Payment failed for topup:', topupNo)
      return new Response('OK', { status: 200 })
    }

    const memberId = existing.MemberID
    const amt      = existing.Amount

    // ── 入帳錢包（upsert + 取得變動前後餘額）────────────────────
    // 1. 取得現有餘額
    const { data: wallet } = await supabase.schema(dbSchema).from('C_MBR_WalletList')
      .select('Balance')
      .eq('MemberID', memberId)
      .maybeSingle()

    const balanceBefore = wallet?.Balance ?? 0
    const balanceAfter  = balanceBefore + amt

    // 2. Upsert 錢包
    await supabase.schema(dbSchema).from('C_MBR_WalletList').upsert({
      MemberID:    memberId,
      Balance:     balanceAfter,
      UpdatedDate: new Date().toISOString(),
    }, { onConflict: 'MemberID' })

    // 3. 寫入交易流水帳
    await supabase.schema(dbSchema).from('C_MBR_WalletTxList').insert({
      MemberID:       memberId,
      TxType:         'topup',
      Amount:         amt,
      BalanceBefore:  balanceBefore,
      BalanceAfter:   balanceAfter,
      RelatedTopupNo: topupNo,
    })

    console.log(`[wallet-topup-notify] Credited ${amt} to ${memberId}, balance: ${balanceBefore} → ${balanceAfter}`)

    // ── 自動開立 ezPay 發票 ──────────────────────────────────────
    try {
      const merchantId = Deno.env.get('EZPAY_MERCHANT_ID')!
      const ezKey      = Deno.env.get('EZPAY_HASH_KEY')!.trim()
      const ezIV       = Deno.env.get('EZPAY_HASH_IV')!.trim()
      const ezEnv      = Deno.env.get('EZPAY_ENV') || 'test'
      const baseUrl    = ezEnv === 'prod' ? 'https://inv.ezpay.com.tw' : 'https://cinv.ezpay.com.tw'

      const { data: authUser } = await supabase.auth.admin.getUserById(memberId)
      const buyerEmail = authUser?.user?.email ?? ''

      const isB2B      = existing.InvoiceCarrierType === 'B2B'
      const isDonate   = existing.InvoiceCarrierType === 'D'
      const hasCarrier = ['0', '1', '2'].includes(existing.InvoiceCarrierType ?? '')

      const taxAmt   = amt - Math.round(amt / 1.05)
      const saleAmt  = amt - taxAmt

      const invoiceParams: Record<string, string> = {
        RespondType:     'JSON',
        Version:         '1.5',
        TimeStamp:       String(Math.floor(Date.now() / 1000)),
        MerchantOrderNo: topupNo,
        Status:          '1',
        Category:        isB2B ? 'B2B' : 'B2C',
        BuyerName:       '消費者',
        PrintFlag:       (hasCarrier || isDonate) ? 'N' : 'Y',
        TaxType:         '1',
        TaxRate:         '5',
        Amt:             String(saleAmt),
        TaxAmt:          String(taxAmt),
        TotalAmt:        String(amt),
        ItemName:        '錢包儲值',
        ItemCount:       '1',
        ItemUnit:        '式',
        ItemPrice:       String(amt),
        ItemAmt:         String(amt),
      }
      if (buyerEmail)                               invoiceParams.BuyerEmail  = buyerEmail
      if (hasCarrier && existing.InvoiceCarrierNum) {
        invoiceParams.CarrierType = existing.InvoiceCarrierType!
        invoiceParams.CarrierNum  = encodeURIComponent(existing.InvoiceCarrierNum)
      }
      if (isDonate && existing.InvoiceLoveCode)     invoiceParams.LoveCode    = existing.InvoiceLoveCode
      if (isB2B    && existing.InvoiceBuyerUBN)     invoiceParams.BuyerUBN    = existing.InvoiceBuyerUBN

      const postData = ezpayEncrypt(buildPostData(invoiceParams), ezKey, ezIV)
      const res = await fetch(`${baseUrl}/Api/invoice_issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ MerchantID_: merchantId, PostData_: postData }).toString(),
      })
      const text = await res.text()
      console.log('[wallet-topup-notify] ezPay invoice raw:', text.slice(0, 300))
      let apiData: Record<string, unknown> = {}
      try { apiData = JSON.parse(text) } catch { apiData = Object.fromEntries(new URLSearchParams(text)) }

      if (apiData.Status === 'SUCCESS') {
        const raw = apiData.Result
        const r: Record<string, string> = typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, string>
        await supabase.schema(dbSchema).from('C_MBR_WalletTopupList').update({
          InvoiceStatus:    'issued',
          InvoiceNo:        r.InvoiceTransNo,
          InvoiceNumber:    r.InvoiceNumber,
          InvoiceRandomNum: r.RandomNum,
          InvoiceIssuedAt:  new Date().toISOString(),
          UpdatedDate:      new Date().toISOString(),
        }).eq('TopupNo', topupNo)
        console.log('[wallet-topup-notify] Invoice issued:', r.InvoiceNumber)
      } else {
        console.warn('[wallet-topup-notify] Invoice failed:', apiData.Message || apiData.Status)
      }
    } catch (invErr) {
      console.warn('[wallet-topup-notify] Invoice error (non-fatal):', invErr instanceof Error ? invErr.message : invErr)
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[wallet-topup-notify] error:', err instanceof Error ? err.message : err)
    return new Response('Internal error', { status: 500 })
  }
})
