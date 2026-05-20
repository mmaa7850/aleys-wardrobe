import { createClient } from '@supabase/supabase-js'

const LINE_CHANNEL_SECRET       = Deno.env.get('LINE_CHANNEL_SECRET')!
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SITE_URL                  = Deno.env.get('SITE_URL') || 'https://aleys-wardrobe.vercel.app'
const DB_SCHEMA                 = Deno.env.get('DB_SCHEMA') || 'public'

// ── LINE 簽名驗證（HMAC-SHA256, base64）────────────────────────────
async function verifySignature(body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(LINE_CHANNEL_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const sig     = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const computed = btoa(String.fromCharCode(...new Uint8Array(sig)))
    return computed === signature
  } catch {
    return false
  }
}

// ── 發送 LINE 文字訊息 ──────────────────────────────────────────────
async function pushMessage(lineUserId: string, text: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to:       lineUserId,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[line-webhook] push failed:', err)
  }
}

// ── 主程式 ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  const body      = await req.text()
  const signature = req.headers.get('x-line-signature') || ''

  if (!await verifySignature(body, signature)) {
    console.error('[line-webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: { events: Record<string, unknown>[] }
  try { payload = JSON.parse(body) } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  for (const event of payload.events ?? []) {
    const lineUserId = (event.source as Record<string, string>)?.userId
    if (!lineUserId) continue

    // ── 加好友 ──────────────────────────────────────────────────────
    if (event.type === 'follow') {
      const token = crypto.randomUUID()

      const { error: insertErr } = await supabase.schema(DB_SCHEMA)
        .from('LineBindToken')
        .insert({ Token: token, LineUserID: lineUserId })

      if (insertErr) {
        console.error('[line-webhook] token insert error:', insertErr.message)
        continue
      }

      const bindUrl = `${SITE_URL}/bind-line?token=${token}`
      await pushMessage(
        lineUserId,
        `歡迎加入 Aley's Wardrobe！🎀\n\n請點以下連結綁定您的帳號，之後直播下單通知會自動傳送給您：\n\n${bindUrl}\n\n（連結 7 天內有效，每次加好友都會重新產生）`,
      )
      console.log('[line-webhook] follow → token sent:', lineUserId)
    }

    // ── 封鎖 / 取消追蹤 ────────────────────────────────────────────
    if (event.type === 'unfollow') {
      const { error } = await supabase.schema(DB_SCHEMA)
        .from('C_MBR_MemberList')
        .update({ LineUserID: null })
        .eq('LineUserID', lineUserId)
      if (error) console.error('[line-webhook] unfollow clear error:', error.message)
      else console.log('[line-webhook] unfollow → LineUserID cleared:', lineUserId)
    }
  }

  return new Response('OK', { status: 200 })
})
