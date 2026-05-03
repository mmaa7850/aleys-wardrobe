import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function aesEncrypt(text: string, key: string, iv: string): Promise<string> {
  const k = new Uint8Array(32); k.set(new TextEncoder().encode(key).slice(0, 32))
  const i = new Uint8Array(16); i.set(new TextEncoder().encode(iv).slice(0, 16))
  const ck = await crypto.subtle.importKey('raw', k, { name: 'AES-CBC' }, false, ['encrypt'])
  const enc = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: i }, ck, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(enc)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Up(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error } = await sb.auth.getUser()
    if (error || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const merchantId  = Deno.env.get('NEWEBPAY_MERCHANT_ID')!
    const hashKey     = (Deno.env.get('NEWEBPAY_LGS_HASH_KEY') || Deno.env.get('NEWEBPAY_HASH_KEY')!).trim()
    const hashIV      = (Deno.env.get('NEWEBPAY_LGS_HASH_IV')  || Deno.env.get('NEWEBPAY_HASH_IV')!).trim()
    const env         = Deno.env.get('NEWEBPAY_ENV') || 'test'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    // Compute SHA256 of the actual key values so we can compare with Supabase dashboard digest
    const hashKeyDigest = (await sha256Up(hashKey)).toLowerCase()
    const hashIVDigest  = (await sha256Up(hashIV)).toLowerCase()
    console.log('[store-map] SHA256(hashKey):', hashKeyDigest)
    console.log('[store-map] SHA256(hashIV): ', hashIVDigest)
    console.log('[store-map] merchantId:', merchantId)
    console.log('[store-map] hashKey length:', hashKey.length, '| first4:', hashKey.substring(0, 4))
    console.log('[store-map] hashIV  length:', hashIV.length,  '| first4:', hashIV.substring(0, 4))

    const mapUrl = env === 'prod'
      ? 'https://core.newebpay.com/API/Logistic/storeMap'
      : 'https://ccore.newebpay.com/API/Logistic/storeMap'

    const timeStamp   = Math.floor(Date.now() / 1000)
    const tempOrderNo = `TEMP_${timeStamp}`
    const returnUrl = `${supabaseUrl}/functions/v1/store-callback`

    // Logistics API expects JSON-encoded inner data (NOT query string)
    const innerObj = {
      MerchantOrderNo: merchantId,
      LgsType:         'C2C',
      ShipType:        '1',
      TimeStamp:       String(timeStamp),
      ReturnURL:       returnUrl,
    }
    const inner      = JSON.stringify(innerObj)
    console.log('[store-map] inner JSON:', inner)
    const encryptData = await aesEncrypt(inner, hashKey, hashIV)
    const hashData    = await sha256Up(`HashKey=${hashKey}&${encryptData}&HashIV=${hashIV}`)
    console.log('[store-map] hashData:', hashData)

    return new Response(JSON.stringify({
      url: mapUrl,
      UID_: merchantId,
      EncryptData_: encryptData,
      HashData_: hashData,
      Version_: '1.0',
      RespondType_: 'JSON',
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
