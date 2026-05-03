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
  if (req.method === 'OPTIONS') return new Response('ok')

  try {
    const hashKey  = (Deno.env.get('NEWEBPAY_LGS_HASH_KEY') || Deno.env.get('NEWEBPAY_HASH_KEY')!).trim()
    const hashIV   = (Deno.env.get('NEWEBPAY_LGS_HASH_IV')  || Deno.env.get('NEWEBPAY_HASH_IV')!).trim()
    const siteUrl  = Deno.env.get('SITE_URL') || 'http://localhost:5173'

    const fd = await req.formData()
    const encryptData = fd.get('EncryptData_')?.toString() || fd.get('EncryptData')?.toString() || ''
    if (!encryptData) throw new Error('Missing EncryptData')

    const plain = await aesDecrypt(encryptData, hashKey, hashIV)
    console.log('[store-callback] plain:', plain)

    // NewebPay may return JSON or URL-encoded — handle both
    let storeId = '', storeName = '', storeAddr = ''
    try {
      const parsed = JSON.parse(plain)
      const r = parsed.Result || parsed
      storeId   = String(r.StoreID   || r.CVSStoreID   || '')
      storeName = String(r.StoreName || r.CVSStoreName  || '')
      storeAddr = String(r.StoreAddr || r.CVSAddress    || r.StoreAddress || '')
    } catch {
      const p = Object.fromEntries(new URLSearchParams(plain))
      storeId   = p.StoreID   || ''
      storeName = p.StoreName || ''
      storeAddr = p.StoreAddr || ''
    }

    console.log('[store-callback] storeId:', storeId, 'storeName:', storeName)

    const payload = JSON.stringify({
      type: 'STORE_SELECTED',
      storeId,
      storeName,
      storeAddr,
    })

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>門市選擇完成</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#555}</style>
</head><body>
<p>門市已選擇，視窗即將關閉...</p>
<script>
(function(){
  var d = ${payload};
  console.log('[store-callback] postMessage data:', JSON.stringify(d));
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage(d, '*');
    setTimeout(function(){ window.close(); }, 400);
  } else {
    sessionStorage.setItem('pendingStore', JSON.stringify(d));
    location.href = '${siteUrl}/checkout';
  }
})();
</script>
</body></html>`

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  } catch (err) {
    console.error('[store-callback]', err instanceof Error ? err.message : err)
    return new Response('<html><body><p>Error selecting store. Please close this window and try again.</p></body></html>', {
      status: 500, headers: { 'Content-Type': 'text/html' },
    })
  }
})
