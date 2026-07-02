import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

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

    // 驗證管理員
    const { data: adminUser } = await supabaseAdmin
      .schema(dbSchema).from('S_SYS_AdminUserList')
      .select('IsAdmin, IsActive').eq('UserId', user.id).single()
    if (!adminUser?.IsActive) return json({ error: '無管理員權限' }, 403)

    const { orderNo, type = 'full', refundAmt } = await req.json()
    if (!orderNo) return json({ error: '缺少 orderNo' }, 400)
    if (!['full', 'partial'].includes(type)) return json({ error: 'type 必須為 full 或 partial' }, 400)
    if (type === 'partial' && (!refundAmt || Number(refundAmt) <= 0)) {
      return json({ error: '部分退款請填寫退款金額' }, 400)
    }

    // 查詢訂單
    const { data: order, error: orderErr } = await supabaseAdmin
      .schema(dbSchema).from('C_ORD_OrderList')
      .select('ID, OrderNo, FinalAmount, ShippingFee, WalletDeductAmt, NewebpayAmt, PaymentStatus, CustomerEmail, AdminNote')
      .eq('OrderNo', orderNo).single()

    if (orderErr || !order) return json({ error: '找不到訂單' }, 404)
    if (order.PaymentStatus === 'refunded') return json({ error: '此訂單已退款' }, 400)
    if (order.PaymentStatus !== 'paid') return json({ error: '此訂單非已付款狀態' }, 400)

    // 計算退款金額
    const finalRefundAmt = type === 'full'
      ? Math.max(0, (order.FinalAmount ?? 0) - (order.ShippingFee ?? 0))
      : Number(refundAmt)

    if (finalRefundAmt <= 0) return json({ error: '退款金額必須大於 0' }, 400)
    if (type === 'partial' && finalRefundAmt > (order.FinalAmount ?? 0)) {
      return json({ error: `退款金額不可超過訂單金額 NT$${order.FinalAmount}` }, 400)
    }

    // 透過 CustomerEmail 找到會員的 auth user ID
    const { data: member } = await supabaseAdmin
      .schema(dbSchema).from('C_MBR_MemberList')
      .select('UserID').eq('Email', order.CustomerEmail).maybeSingle()

    if (!member?.UserID) {
      return json({ error: `找不到會員：${order.CustomerEmail}` }, 404)
    }
    const memberId = member.UserID

    // 取得目前錢包餘額（若無錢包則建立）
    const { data: wallet } = await supabaseAdmin
      .schema(dbSchema).from('C_MBR_WalletList')
      .select('Balance').eq('UserID', memberId).maybeSingle()

    const balanceBefore = wallet?.Balance ?? 0
    const balanceAfter  = balanceBefore + finalRefundAmt

    // Upsert 錢包餘額
    await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletList').upsert({
      UserID:      memberId,
      Balance:     balanceAfter,
      UpdatedDate: new Date().toISOString(),
    }, { onConflict: 'UserID' })

    // 寫入交易流水帳
    await supabaseAdmin.schema(dbSchema).from('C_MBR_WalletTxList').insert({
      UserID:         memberId,
      TxType:         'refund',
      Amount:         finalRefundAmt,
      BalanceBefore:  balanceBefore,
      BalanceAfter:   balanceAfter,
      RelatedOrderNo: orderNo,
      Note:           type === 'full' ? '全額退款入錢包' : `部分退款入錢包 NT$${finalRefundAmt}`,
      CreatedBy:      user.id,
    })

    // 更新訂單狀態
    const refundNote = type === 'full'
      ? `[退款] 全額退款 NT$${finalRefundAmt} 已入錢包（${new Date().toLocaleDateString('zh-TW')}）`
      : `[部分退款] NT$${finalRefundAmt} 已入錢包（${new Date().toLocaleDateString('zh-TW')}）`
    const existingNote = order.AdminNote ? `${order.AdminNote}\n${refundNote}` : refundNote

    await supabaseAdmin.schema(dbSchema).from('C_ORD_OrderList').update({
      ...(type === 'full' ? { PaymentStatus: 'refunded' } : {}),
      AdminNote:   existingNote,
      UpdatedDate: new Date().toISOString(),
    }).eq('OrderNo', orderNo)

    console.log(`[wallet-refund] ${type} refund NT$${finalRefundAmt} for order ${orderNo} → ${memberId} (balance: ${balanceBefore} → ${balanceAfter})`)

    return json({ success: true, refundAmt: finalRefundAmt, balanceBefore, balanceAfter })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[wallet-refund] error:', msg)
    return json({ error: msg }, 500)
  }
})
