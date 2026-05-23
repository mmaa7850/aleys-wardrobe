import { createClient } from '@supabase/supabase-js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ── FB Graph API helpers ────────────────────────────────────────

async function fbGet(path: string, token: string, params: Record<string, string> = {}) {
  const p = new URLSearchParams({ access_token: token, ...params })
  const res = await fetch(`https://graph.facebook.com/v19.0/${path}?${p}`)
  return res.json()
}

async function fbPostComment(videoId: string, message: string, token: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${videoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
    })
    if (!res.ok) console.error('[fbPostComment]', await res.text())
  } catch (e) {
    console.error('[fbPostComment] exception:', e)
  }
}

// ── Variant 比對：從留言文字找出最符合的商品規格 ────────────────
function matchVariant(msg: string, candidates: any[]): any {
  const clean = msg.toUpperCase().replace(/\s+/g, '')
  for (const p of candidates) {
    const color = (p.ColorName ?? '').toUpperCase()
    const size  = (p.SizeName  ?? '').toUpperCase()
    const style = `${color}${size}`
    if (style && clean.includes(style)) return p
    if (color && size && clean.includes(color) && clean.includes(size)) return p
    if (color && !size && clean.includes(color)) return p
  }
  // 只有一種規格時不需要消費者指定
  if (candidates.length === 1) return candidates[0]
  return null
}

// ── 生成結標公告文字 ────────────────────────────────────────────
async function buildAnnouncement(
  db: ReturnType<typeof createClient>,
  dbSchema: string,
  sessionId: number,
  code: string,
  productName: string,
  livePrice: number,
  livProducts: any[],
): Promise<string> {
  const { data: orders } = await db
    .schema(dbSchema)
    .from('C_ORD_OrderList')
    .select(`
      C_MBR_MemberList ( FbName ),
      C_ORD_OrderItemList ( Qty, VariantID )
    `)
    .eq('LiveSessionID', sessionId)
    .eq('LiveCode', code)
    .eq('OrderSource', 'live')

  let text = `結標公告：第 ${code} 標 ${productName} 直購標 $${livePrice}`

  for (const order of (orders ?? [])) {
    const fbName = (order as any).C_MBR_MemberList?.FbName ?? '?'
    const rawItems = (order as any).C_ORD_OrderItemList
    const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : []
    for (const item of items) {
      const lp = livProducts.find((p: any) => p.VariantID === item.VariantID)
      const style = lp ? `${lp.ColorName ?? ''}${lp.SizeName ?? ''}`.trim() : ''
      text += ` ${fbName}x${item.Qty}${style ? ` (${style})` : ''}`
    }
  }

  return text
}

// ── 關閉一個開標中的 bid，發結標線 + 結標公告到 FB ───────────────
async function closeBid(
  db: ReturnType<typeof createClient>,
  dbSchema: string,
  bid: any,
  sessionId: number,
  liveVideoId: string,
  pageAccessToken: string,
  livProducts: any[],
  reason: 'sold_out' | 'manual',
) {
  await db.schema(dbSchema)
    .from('C_LIV_ActiveBidList')
    .update({ Status: 'closed', ClosedAt: new Date().toISOString() })
    .eq('ID', bid.ID)

  // 結標線
  await fbPostComment(liveVideoId, `======== 結標線 ========`, pageAccessToken)

  // 結標公告
  // 取此 Code 的直播特價（用第一筆 livProduct 的 LivePrice）
  const firstProd = livProducts.find((p: any) => p.Code.toUpperCase() === bid.Code.toUpperCase())
  const livePrice = firstProd?.LivePrice ?? 0
  const announcement = await buildAnnouncement(db, dbSchema, sessionId, bid.Code, bid.ProductName ?? bid.Code, livePrice, livProducts)
  await fbPostComment(liveVideoId, announcement, pageAccessToken)
}

// ════════════════════════════════════════════════════════════════
// Main handler
// ════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const dbSchema = Deno.env.get('DB_SCHEMA') ?? 'public'

    // 用 anon key 驗證 JWT
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await authClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // 用 service_role 操作 DB
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 驗證管理員身份
    const { data: admin } = await db
      .schema(dbSchema)
      .from('S_SYS_AdminUserList')
      .select('IsActive')
      .eq('UserId', user.id)
      .maybeSingle()
    if (!admin?.IsActive) return json({ error: 'Forbidden' }, 403)

    // ── Parse request ─────────────────────────────────────────
    const body = await req.json()
    const { action = 'poll', sessionId, pageAccessToken, liveVideoId, pageId, since } = body

    if (!sessionId || !pageAccessToken || !pageId) {
      return json({ error: 'Missing: sessionId, pageAccessToken, pageId' }, 400)
    }

    // ── Action: start_bid ────────────────────────────────────
    if (action === 'start_bid') {
      const { code } = body
      if (!code || !liveVideoId) return json({ error: 'Missing: code, liveVideoId' }, 400)

      const codeUpper = (code as string).toUpperCase()

      // 確認此 Code 尚未開標
      const { data: existing } = await db
        .schema(dbSchema)
        .from('C_LIV_ActiveBidList')
        .select('ID')
        .eq('SessionID', sessionId)
        .eq('Code', codeUpper)
        .eq('Status', 'open')
        .maybeSingle()

      if (existing) return json({ error: `${codeUpper} 已開標中，請先截標再重新起標` }, 409)

      // 查商品資訊（取此 Code 所有規格）
      const { data: prods } = await db
        .schema(dbSchema)
        .from('C_LIV_ProductList')
        .select('ProductName, LivePrice, ColorName, SizeName')
        .eq('SessionID', sessionId)
        .eq('Code', codeUpper)

      const firstProd   = prods?.[0]
      const productName = firstProd?.ProductName ?? codeUpper
      const livePrice   = firstProd?.LivePrice ?? 0

      // 留言格式範例（最多列出前 2 種規格）
      const styleExamples = (prods ?? []).slice(0, 2)
        .map((p: any) => `${codeUpper}${p.ColorName ?? ''}${p.SizeName ?? ''}+1`)
        .join('、')

      // 發出起標線留言
      const startMsg = [
        `======== 起標線 ========`,
        `💰 本標商品：${productName}`,
        `💰 直購標：NT$${livePrice}`,
        `📝 入單關鍵字：${codeUpper}`,
        `留言格式：${styleExamples || `${codeUpper}顏色尺寸+1`}`,
      ].join('\n')
      await fbPostComment(liveVideoId, startMsg, pageAccessToken)

      // 建立 ActiveBidList 紀錄
      const { data: bid, error: bidErr } = await db
        .schema(dbSchema)
        .from('C_LIV_ActiveBidList')
        .insert({
          SessionID:   sessionId,
          Code:        codeUpper,
          ProductName: productName,
          Status:      'open',
          OpenedAt:    new Date().toISOString(),
        })
        .select()
        .single()

      if (bidErr) return json({ error: bidErr.message }, 500)
      return json({ ok: true, bid })
    }

    // ── Action: manual_close ──────────────────────────────────
    if (action === 'manual_close') {
      const { code } = body
      if (!code || !liveVideoId) return json({ error: 'Missing: code, liveVideoId' }, 400)

      const { data: bid } = await db
        .schema(dbSchema)
        .from('C_LIV_ActiveBidList')
        .select('*')
        .eq('SessionID', sessionId)
        .eq('Code', code.toUpperCase())
        .eq('Status', 'open')
        .maybeSingle()

      if (!bid) return json({ error: 'No open bid found for this code' }, 404)

      const { data: livProducts } = await db
        .schema(dbSchema)
        .from('C_LIV_ProductList')
        .select('*')
        .eq('SessionID', sessionId)

      await closeBid(db, dbSchema, bid, sessionId, liveVideoId, pageAccessToken, livProducts ?? [], 'manual')
      return json({ ok: true, closed: code })
    }

    // ── Action: poll ──────────────────────────────────────────
    if (!liveVideoId) return json({ error: 'Missing: liveVideoId' }, 400)

    // 1. Fetch comments from FB
    const fbParams: Record<string, string> = {
      fields: 'id,from,message,created_time',
      order: 'chronological',
      limit: '200',
    }
    if (since != null) fbParams.since = String(since)

    const fbData = await fbGet(`${liveVideoId}/comments`, pageAccessToken, fbParams)
    if (fbData.error) return json({ error: `FB API: ${fbData.error.message}` }, 400)

    const allComments: any[] = fbData.data ?? []

    if (!allComments.length) {
      return json({ newActiveBids: [], closedBids: [], orders: [], nextSince: since ?? null, processedCount: 0 })
    }

    // 2. 過濾已處理的留言
    const commentIds = allComments.map((c: any) => c.id)
    const { data: processedRows } = await db
      .schema(dbSchema)
      .from('C_LIV_ProcessedCommentList')
      .select('FbCommentId')
      .eq('SessionID', sessionId)
      .in('FbCommentId', commentIds)

    const processedSet = new Set((processedRows ?? []).map((r: any) => r.FbCommentId))

    // FIFO：舊留言優先處理
    const newComments = allComments
      .filter((c: any) => !processedSet.has(c.id))
      .sort((a: any, b: any) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime())

    if (!newComments.length) {
      const lastTs = allComments[allComments.length - 1]?.created_time
      const nextSince = lastTs ? Math.floor(new Date(lastTs).getTime() / 1000) + 1 : since
      return json({ newActiveBids: [], closedBids: [], orders: [], nextSince, processedCount: 0 })
    }

    // 3. 載入場次資料
    const [{ data: livProducts }, { data: activeBidsRaw }] = await Promise.all([
      db.schema(dbSchema).from('C_LIV_ProductList').select('*').eq('SessionID', sessionId),
      db.schema(dbSchema).from('C_LIV_ActiveBidList').select('*').eq('SessionID', sessionId).eq('Status', 'open'),
    ])

    const activeBids: any[] = activeBidsRaw ? [...activeBidsRaw] : []
    const toMark: any[] = []
    const results = {
      newActiveBids: [] as any[],
      closedBids: [] as any[],
      orders: [] as any[],
    }

    // 4. 逐則處理留言
    for (const comment of newComments) {
      const isFromPage = String(comment.from?.id ?? '') === String(pageId)
      const msg: string = (comment.message ?? '').trim()
      const fbUserId = String(comment.from?.id ?? '')
      const fbUserName = String(comment.from?.name ?? '')

      // ── 粉專自己的留言：只看起標線 ──────────────────────────
      if (isFromPage) {
        if (msg.includes('起標線')) {
          const codeMatch = msg.match(/入單關鍵字[：:]\s*([A-Za-z0-9]+)/)
          if (codeMatch) {
            const code = codeMatch[1].toUpperCase()
            // 如果這個 Code 已經開標中就跳過（防止重複發起標線）
            const alreadyOpen = activeBids.find((b: any) => b.Code === code)
            if (!alreadyOpen) {
              const prod = (livProducts ?? []).find((p: any) => p.Code.toUpperCase() === code)
              const { data: inserted } = await db
                .schema(dbSchema)
                .from('C_LIV_ActiveBidList')
                .insert({
                  SessionID:   sessionId,
                  Code:        code,
                  ProductName: prod?.ProductName ?? code,
                  Status:      'open',
                  OpenedAt:    comment.created_time,
                })
                .select()
                .single()
              if (inserted) {
                results.newActiveBids.push(inserted)
                activeBids.push(inserted)
              }
            }
          }
        }
        toMark.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId })
        continue
      }

      // ── 消費者留言：比對開標中商品 ───────────────────────────
      let handled = false

      for (const activeBid of activeBids) {
        const code = activeBid.Code.toUpperCase()
        if (!msg.toUpperCase().includes(code)) continue

        // 找出對應規格
        const candidates = (livProducts ?? []).filter((p: any) => p.Code.toUpperCase() === code)

        // ── 包色偵測：留言含「包色」→ 展開為所有顏色各 1 件 ──
        const isBundle = msg.toUpperCase().replace(/\s+/g, '').includes('包色')

        // helper：建立單筆訂單並回補庫存（失敗時）
        const createOrder = async (livProduct: any) => {
          const dedupKey = `${code}|${livProduct.VariantID}`

          // 去重：同人同款已下單
          const { data: dupRow } = await db
            .schema(dbSchema)
            .from('C_LIV_ProcessedCommentList')
            .select('ID')
            .eq('SessionID', sessionId)
            .eq('FbUserId', fbUserId)
            .eq('DedupKey', dedupKey)
            .maybeSingle()
          if (dupRow) return { status: 'dup', dedupKey }

          // 找會員（by FbName）
          const { data: member } = await db
            .schema(dbSchema)
            .from('C_MBR_MemberList')
            .select('ID, LineUserID')
            .eq('FbName', fbUserName)
            .maybeSingle()
          if (!member) return { status: 'no_member', dedupKey }

          // 扣庫存
          const { data: stockOk } = await db.rpc('decrement_stock', {
            p_variant_id: livProduct.VariantID, p_qty: 1,
          })
          if (!stockOk) return { status: 'no_stock', dedupKey }

          // 取 ProductID
          const { data: variant } = await db
            .schema(dbSchema)
            .from('C_PRD_ProductVariantList')
            .select('ProductID')
            .eq('ID', livProduct.VariantID)
            .maybeSingle()

          // 建訂單
          const now2 = new Date()
          const pad2 = (n: number) => String(n).padStart(2, '0')
          const datePart2 = `${now2.getFullYear()}${pad2(now2.getMonth() + 1)}${pad2(now2.getDate())}`
          const rand2 = Math.random().toString(36).slice(2, 7).toUpperCase()
          const orderNo2 = `LIV_${datePart2}_${rand2}`

          const { data: order, error: orderErr } = await db
            .schema(dbSchema)
            .from('C_ORD_OrderList')
            .insert({
              OrderNo:       orderNo2,
              MemberID:      member.ID,
              OrderSource:   'live',
              LiveSessionID: sessionId,
              LiveCode:      code,
              PaymentStatus: 'pending',
              FinalAmount:   livProduct.LivePrice,
              ShippingFee:   0,
            })
            .select('ID')
            .single()

          if (orderErr || !order) {
            await db.rpc('restore_stock', { p_variant_id: livProduct.VariantID, p_qty: 1 })
            return { status: 'error', dedupKey, reason: orderErr?.message }
          }

          await db.schema(dbSchema).from('C_ORD_OrderItemList').insert({
            OrderID:   order.ID,
            ProductID: variant?.ProductID ?? null,
            VariantID: livProduct.VariantID,
            Qty:       1,
            UnitPrice: livProduct.LivePrice,
          })

          // LINE 通知
          const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') ?? ''
          const siteUrl   = Deno.env.get('SITE_URL') ?? ''
          if (member.LineUserID && lineToken) {
            const style2   = `${livProduct.ColorName ?? ''}${livProduct.SizeName ?? ''}`.trim()
            const payUrl  = `${siteUrl}/orders/${orderNo2}`
            const bundleTxt = isBundle ? '（包色）' : ''
            const lineMsg = `🎉 恭喜搶到${bundleTxt}！\n${livProduct.ProductName}${style2 ? ` ${style2}` : ''}\n請在 24 小時內完成付款：\n${payUrl}`
            await fetch('https://api.line.me/v2/bot/message/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lineToken}` },
              body: JSON.stringify({ to: member.LineUserID, messages: [{ type: 'text', text: lineMsg }] }),
            }).catch(() => {/* 不讓 LINE 失敗影響建單流程 */})
          }

          return { status: 'success', dedupKey, orderNo: orderNo2 }
        }

        if (isBundle) {
          // 包色：每個顏色各建一筆訂單
          if (!candidates.length) {
            toMark.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId, DedupKey: null })
            handled = true
            break
          }
          const bundleMarks: any[] = []
          for (const bp of candidates) {
            const r = await createOrder(bp)
            const style = `${bp.ColorName ?? ''}${bp.SizeName ?? ''}`.trim()
            if (r.status === 'success') {
              results.orders.push({ fbName: fbUserName, code, orderNo: r.orderNo, style, status: 'success', isBundle: true })
            } else {
              results.orders.push({ fbName: fbUserName, code, style, status: r.status, isBundle: true })
            }
            bundleMarks.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId, DedupKey: r.dedupKey ?? null })
          }
          // 只記錄一筆 processed（FbCommentId 唯一，後續 upsert 合一）
          toMark.push(bundleMarks[0])
        } else {
          // 一般單色
          const livProduct = matchVariant(msg, candidates)

          if (!livProduct) {
            // 看得出來在搶這個 Code，但樣式解析不到 → 記錄但不建單
            toMark.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId, DedupKey: null })
            handled = true
            break
          }

          const r = await createOrder(livProduct)
          const style = `${livProduct.ColorName ?? ''}${livProduct.SizeName ?? ''}`.trim()
          if (r.status === 'success') {
            results.orders.push({ fbName: fbUserName, code, orderNo: r.orderNo, style, status: 'success' })
          } else {
            results.orders.push({ fbName: fbUserName, code, style, status: r.status, reason: (r as any).reason })
          }
          toMark.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId, DedupKey: r.dedupKey ?? null })
        }

        handled = true

        // ── 檢查此 Code 所有規格庫存是否都歸零 ─────────────────
        const codeVariantIds = (livProducts ?? [])
          .filter((p: any) => p.Code.toUpperCase() === code)
          .map((p: any) => p.VariantID)

        const { data: stocks } = await db
          .schema(dbSchema)
          .from('C_PRD_ProductVariantList')
          .select('StockQty')
          .in('ID', codeVariantIds)

        const totalStock = (stocks ?? []).reduce((s: number, v: any) => s + (v.StockQty ?? 0), 0)

        if (totalStock === 0) {
          await closeBid(db, dbSchema, activeBid, sessionId, liveVideoId, pageAccessToken, livProducts ?? [], 'sold_out')
          results.closedBids.push({ code, productName: activeBid.ProductName, reason: 'sold_out' })
          const idx = activeBids.findIndex((b: any) => b.ID === activeBid.ID)
          if (idx >= 0) activeBids.splice(idx, 1)
        }

        break
      }

      if (!handled) {
        // 沒有匹配任何開標商品的留言，僅記錄避免重複處理
        toMark.push({ SessionID: sessionId, FbCommentId: comment.id, FbUserId: fbUserId })
      }
    }

    // 5. 批次標記已處理
    if (toMark.length) {
      await db.schema(dbSchema)
        .from('C_LIV_ProcessedCommentList')
        .upsert(toMark, { onConflict: 'SessionID,FbCommentId', ignoreDuplicates: true })
    }

    // 6. 計算下次 since（FB API Unix timestamp）
    const lastTs = allComments[allComments.length - 1]?.created_time
    const nextSince = lastTs ? Math.floor(new Date(lastTs).getTime() / 1000) + 1 : (since ?? null)

    return json({ ...results, nextSince, processedCount: newComments.length })

  } catch (err: any) {
    console.error('[live-bid-poll] error:', err)
    return json({ error: err?.message ?? String(err) }, 500)
  }
})
