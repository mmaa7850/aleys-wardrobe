import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  const siteUrl = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'

  try {
    const hashKey  = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV   = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    const params    = new URLSearchParams(await req.text())
    const tradeInfo = params.get('TradeInfo') ?? ''
    if (!tradeInfo) return Response.redirect(`${siteUrl}/`, 302)

    const decrypted = await aesDecrypt(tradeInfo, hashKey, hashIV)
    let result: Record<string, string> = {}
    try {
      const p = JSON.parse(decrypted)
      result = { ...p, ...(p.Result || {}) }
    } catch {
      result = Object.fromEntries(new URLSearchParams(decrypted))
    }

    const orderNo     = (result.MerchantOrderNo || '').replace(/_R\d+$/, '')
    const paymentType = result.PaymentType || ''

    console.log('[payment-return] orderNo:', orderNo, '| paymentType:', paymentType)

    // Persist payment method and ATM virtual account info to DB
    if (orderNo) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      const methodMap: Record<string, string> = {
        CREDIT: 'credit', WEBATM: 'webatm', VACC: 'atm', CVS: 'cvs',
      }
      const updates: Record<string, string> = {
        PaymentMethod: methodMap[paymentType] || paymentType.toLowerCase(),
        UpdatedDate:   new Date().toISOString(),
      }
      if (result.BankCode) updates.ATMBankCode = result.BankCode
      if (result.CodeNo)   updates.ATMAccount  = result.CodeNo

      const { error } = await supabase.schema(dbSchema)
        .from('C_ORD_OrderList')
        .update(updates)
        .eq('OrderNo', orderNo)
      if (error) console.error('[payment-return] DB update error:', error.message)
      else console.log('[payment-return] saved PaymentMethod:', updates.PaymentMethod, '| ATM:', result.BankCode, result.CodeNo)
    }

    if (!orderNo) return Response.redirect(`${siteUrl}/`, 302)
    return Response.redirect(`${siteUrl}/order-success/${orderNo}`, 302)

  } catch (err) {
    console.error('[payment-return] error:', err instanceof Error ? err.message : err)
    return Response.redirect(`${siteUrl}/`, 302)
  }
})
