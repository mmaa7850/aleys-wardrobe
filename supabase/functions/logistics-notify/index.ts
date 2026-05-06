import { createClient } from '@supabase/supabase-js'

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
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    const hashKey = Deno.env.get('NEWEBPAY_LGS_HASH_KEY') || Deno.env.get('NEWEBPAY_HASH_KEY')!
    const hashIV  = Deno.env.get('NEWEBPAY_LGS_HASH_IV')  || Deno.env.get('NEWEBPAY_HASH_IV')!

    const ct = req.headers.get('content-type') || ''
    let encryptData = ''

    if (ct.includes('application/json')) {
      const body = await req.json()
      encryptData = body.EncryptData_ || body.EncryptData || ''
    } else {
      const fd = await req.formData()
      encryptData = fd.get('EncryptData_')?.toString() || fd.get('EncryptData')?.toString() || ''
    }

    if (!encryptData) return new Response('Missing data', { status: 400 })

    const plain = await aesDecrypt(encryptData, hashKey, hashIV)
    let result: Record<string, string>
    try { result = JSON.parse(plain) } catch { result = Object.fromEntries(new URLSearchParams(plain)) }

    const orderNo   = result.MerchantOrderNo || ''
    const lgsNo     = result.LgsNo           || ''
    const retId     = result.RetId           || ''
    const retString = result.RetString       || ''

    console.log('[logistics-notify] raw keys:', Object.keys(result).join(', '))
    console.log('[logistics-notify] orderNo:', orderNo, '| retId:', retId, '| retString:', retString)

    if (!orderNo) return new Response('Missing orderNo', { status: 400 })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    const updatePayload: Record<string, string> = {
      ShippingStatus:     retId,
      ShippingStatusText: retString,
      UpdatedDate:        new Date().toISOString(),
    }
    if (lgsNo) updatePayload.LgsNo = lgsNo

    await supabase
      .schema(dbSchema)
      .from('C_ORD_OrderList')
      .update(updatePayload)
      .eq('OrderNo', orderNo)

    console.log(`[logistics-notify] ${orderNo} → ${retId} ${retString}`)
    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('[logistics-notify]', err instanceof Error ? err.message : err)
    return new Response('Internal error', { status: 500 })
  }
})
