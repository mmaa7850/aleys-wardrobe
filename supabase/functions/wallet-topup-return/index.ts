// wallet-topup-return
// 藍新付款後使用者瀏覽器的 redirect（CustomerURL / ReturnURL）
// 只負責導向前台，實際入帳由 wallet-topup-notify 處理

import { createClient } from '@supabase/supabase-js'

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

Deno.serve(async (req) => {
  const siteUrl  = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'
  const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

  try {
    const hashKey = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV  = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()

    const params    = new URLSearchParams(await req.text())
    const tradeInfo = params.get('TradeInfo') ?? ''
    const status    = params.get('Status')    ?? ''

    if (!tradeInfo) return Response.redirect(`${siteUrl}/wallet`, 302)

    const decrypted = await aesDecrypt(tradeInfo, hashKey, hashIV)
    let result: Record<string, string> = {}
    try { const p = JSON.parse(decrypted); result = { ...p, ...(p.Result || {}) } }
    catch { result = Object.fromEntries(new URLSearchParams(decrypted)) }

    const isSuccess   = (status === 'SUCCESS' || result.Status === 'SUCCESS')
    const paymentType = result.PaymentType || ''
    const topupNo     = result.MerchantOrderNo || ''

    // ATM 取號成功：Status=SUCCESS 只代表虛擬帳號取號完成，實際尚未轉帳
    // 需將銀行代碼+虛擬帳號存進 DB，並導向「待轉帳」狀態頁面
    if (isSuccess && paymentType === 'VACC' && topupNo) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        // Newebpay ExpireDate 格式：YYYYMMDD
        const rawExpire  = result.ExpireDate || ''
        const expireDate = rawExpire.length === 8
          ? `${rawExpire.slice(0, 4)}-${rawExpire.slice(4, 6)}-${rawExpire.slice(6, 8)}`
          : null

        const { error: updateErr } = await supabase.schema(dbSchema).from('C_MBR_WalletTopupList').update({
          ATMBankCode:   result.BankCode || null,
          ATMAccount:    result.CodeNo   || null,
          ATMExpireDate: expireDate,
          PaymentMethod: 'atm',
          UpdatedDate:   new Date().toISOString(),
        }).eq('TopupNo', topupNo)

        if (updateErr) {
          console.error('[wallet-topup-return] ATM DB update error:', updateErr.message, '| schema:', dbSchema, '| topupNo:', topupNo)
        } else {
          console.log('[wallet-topup-return] ATM issued, topupNo:', topupNo, 'bank:', result.BankCode, 'account:', result.CodeNo, '| schema:', dbSchema)
        }
      } catch (e) {
        console.error('[wallet-topup-return] ATM DB update error:', e instanceof Error ? e.message : e)
      }
      return Response.redirect(`${siteUrl}/wallet?topup=atm_pending&topupNo=${encodeURIComponent(topupNo)}`, 302)
    }

    // 信用卡 / LINE Pay 等即時付款
    const payStatus = isSuccess ? 'success' : 'fail'
    return Response.redirect(`${siteUrl}/wallet?topup=${payStatus}`, 302)

  } catch (err) {
    console.error('[wallet-topup-return] error:', err instanceof Error ? err.message : err)
    return Response.redirect(`${siteUrl}/wallet?topup=fail`, 302)
  }
})
