// wallet-topup-return
// 藍新付款後使用者瀏覽器的 redirect（CustomerURL / ReturnURL）
// 只負責導向前台，實際入帳由 wallet-topup-notify 處理

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
  const siteUrl = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'

  try {
    const hashKey = Deno.env.get('NEWEBPAY_HASH_KEY')!.trim()
    const hashIV  = Deno.env.get('NEWEBPAY_HASH_IV')!.trim()

    const params    = new URLSearchParams(await req.text())
    const tradeInfo = params.get('TradeInfo') ?? ''
    const status    = params.get('Status') ?? ''

    if (!tradeInfo) return Response.redirect(`${siteUrl}/wallet`, 302)

    const decrypted = await aesDecrypt(tradeInfo, hashKey, hashIV)
    let result: Record<string, string> = {}
    try { const p = JSON.parse(decrypted); result = { ...p, ...(p.Result || {}) } }
    catch { result = Object.fromEntries(new URLSearchParams(decrypted)) }

    const payStatus = (status === 'SUCCESS' || result.Status === 'SUCCESS') ? 'success' : 'fail'
    return Response.redirect(`${siteUrl}/wallet?topup=${payStatus}`, 302)

  } catch (err) {
    console.error('[wallet-topup-return] error:', err instanceof Error ? err.message : err)
    return Response.redirect(`${siteUrl}/wallet?topup=fail`, 302)
  }
})
