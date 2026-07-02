import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    // 身份驗證
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const dbSchema = Deno.env.get('DB_SCHEMA') || 'public'

    // 管理員權限驗證
    const { data: adminUser } = await supabaseAdmin
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive')
      .eq('UserId', user.id)
      .single()
    if (!adminUser?.IsAdmin || !adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    // ── GET：查詢指定會員的錢包資訊 ─────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const memberId = url.searchParams.get('memberId')
      if (!memberId) return json({ error: '缺少 memberId' }, 400)

      const [walletRes, txRes] = await Promise.all([
        supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList')
          .select('Balance, UpdatedDate')
          .eq('UserID', memberId)
          .maybeSingle(),
        supabaseAdmin.schema(dbSchema).from('C_MBR_WalletTxList')
          .select('*')
          .eq('UserID', memberId)
          .order('CreatedDate', { ascending: false })
          .limit(50),
      ])

      return json({
        balance:      walletRes.data?.Balance ?? 0,
        updatedDate:  walletRes.data?.UpdatedDate ?? null,
        transactions: txRes.data ?? [],
      })
    }

    // ── POST：手動調整餘額 ───────────────────────────────────────
    if (req.method === 'POST') {
      const { memberId, amount, note } = await req.json()
      if (!memberId) return json({ error: '缺少 memberId' }, 400)
      const adjAmt = Number(amount)
      if (!adjAmt || !Number.isInteger(adjAmt)) return json({ error: '請填寫有效的調整金額（整數，正數=增加，負數=扣除）' }, 400)
      if (!note?.trim()) return json({ error: '請填寫調整原因' }, 400)

      // 取得現有餘額
      const { data: wallet } = await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList')
        .select('Balance')
        .eq('UserID', memberId)
        .maybeSingle()

      const balanceBefore = wallet?.Balance ?? 0
      const balanceAfter  = balanceBefore + adjAmt

      if (balanceAfter < 0) return json({ error: `餘額不足，目前餘額 NT$${balanceBefore}，無法扣除 NT$${Math.abs(adjAmt)}` }, 400)

      // Upsert 錢包
      await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList').upsert({
        UserID:      memberId,
        Balance:     balanceAfter,
        UpdatedDate: new Date().toISOString(),
      }, { onConflict: 'UserID' })

      // 流水帳
      await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletTxList').insert({
        UserID:        memberId,
        TxType:        'adjust',
        Amount:        adjAmt,
        BalanceBefore: balanceBefore,
        BalanceAfter:  balanceAfter,
        Note:          note.trim(),
        CreatedBy:     user.id,
      })

      console.log(`[wallet-adjust] Admin ${user.id} adjusted member ${memberId}: ${balanceBefore} → ${balanceAfter}, note: ${note}`)
      return json({ success: true, balanceBefore, balanceAfter })
    }

    return json({ error: '不支援的方法' }, 405)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[wallet-adjust] error:', msg)
    return json({ error: msg }, 500)
  }
})
