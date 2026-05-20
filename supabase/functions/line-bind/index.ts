import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const DB_SCHEMA            = Deno.env.get('DB_SCHEMA') || 'public'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')   return new Response('Method Not Allowed', { status: 405 })

  try {
    // ── 驗證使用者登入 ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(
      JSON.stringify({ error: '請先登入' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return new Response(
      JSON.stringify({ error: '登入驗證失敗' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

    // ── 解析 token ──────────────────────────────────────────────────
    const body = await req.json()
    const token: string = body?.token
    if (!token) return new Response(
      JSON.stringify({ error: '缺少 token' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── 驗證 token 有效性 ────────────────────────────────────────────
    const { data: bindToken, error: tokenErr } = await supabase.schema(DB_SCHEMA)
      .from('LineBindToken')
      .select('*')
      .eq('Token', token)
      .is('UsedAt', null)
      .gt('ExpiresAt', new Date().toISOString())
      .maybeSingle()

    if (tokenErr || !bindToken) return new Response(
      JSON.stringify({ error: '連結無效或已過期，請重新加入 LINE 官方帳號取得新連結' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

    const lineUserId: string = bindToken.LineUserID

    // ── 寫入 LineUserID：upsert 確保即使尚無 MemberList 記錄也能寫入 ─
    const { error: updateErr } = await supabase.schema(DB_SCHEMA)
      .from('C_MBR_MemberList')
      .upsert(
        { UserID: user.id, Email: user.email ?? '', LineUserID: lineUserId },
        { onConflict: 'UserID' },
      )

    if (updateErr) {
      console.error('[line-bind] upsert error:', updateErr.message)
      return new Response(
        JSON.stringify({ error: '綁定失敗，請稍後再試' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // ── 標記 token 已使用 ───────────────────────────────────────────
    await supabase.schema(DB_SCHEMA)
      .from('LineBindToken')
      .update({ UsedAt: new Date().toISOString() })
      .eq('Token', token)

    console.log('[line-bind] success, user:', user.id, '→ lineUserId:', lineUserId)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err) {
    console.error('[line-bind] error:', err instanceof Error ? err.message : err)
    return new Response(
      JSON.stringify({ error: '伺服器錯誤' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
