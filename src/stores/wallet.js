import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'

export const useWalletStore = defineStore('wallet', {
  state: () => ({
    balance:      0,
    transactions: [],
    loaded:       false,
    loading:      false,
  }),

  actions: {
    async fetchBalance() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { this.balance = 0; this.loaded = true; return }

      const { data } = await db
        .from('C_MBR_WalletList')
        .select('Balance')
        .eq('UserID', user.id)
        .maybeSingle()

      this.balance = data?.Balance ?? 0
      this.loaded  = true
    },

    async fetchTransactions() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await db
        .from('C_MBR_WalletTxList')
        .select('*')
        .eq('UserID', user.id)
        .order('CreatedDate', { ascending: false })
        .limit(50)

      this.transactions = data ?? []
    },

    // 儲值：呼叫 edge function，取得藍新付款參數
    async topup({ amount, invoiceCarrierType = null, invoiceCarrierNum = null, invoiceLoveCode = null, invoiceBuyerUBN = null }) {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-topup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ amount, invoiceCarrierType, invoiceCarrierNum, invoiceLoveCode, invoiceBuyerUBN }),
        }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return await res.json()  // { gatewayUrl, MerchantID, TradeInfo, TradeSha, TimeStamp, Version, MerchantOrderNo }
    },

    reset() {
      this.balance = 0
      this.transactions = []
      this.loaded = false
    },
  },
})
