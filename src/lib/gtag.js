const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID

export function initGA() {
  if (!GA_ID) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
  window.dataLayer = window.dataLayer || []
  window.gtag = function () { window.dataLayer.push(arguments) }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, { send_page_view: false })
}

export function trackPageView(path, title) {
  if (!GA_ID || typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title,
  })
}

export function trackEvent(name, params = {}) {
  if (!GA_ID || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

export function trackViewItem(product) {
  trackEvent('view_item', {
    currency: 'TWD',
    value: product.Price,
    items: [{
      item_id: String(product.ID),
      item_name: product.ProductName,
      item_category: product.Category ?? '',
      price: product.Price,
      quantity: 1,
    }],
  })
}

export function trackAddToCart(product, qty, colorName, sizeName) {
  trackEvent('add_to_cart', {
    currency: 'TWD',
    value: product.Price * qty,
    items: [{
      item_id: String(product.ID),
      item_name: product.ProductName,
      item_category: product.Category ?? '',
      price: product.Price,
      quantity: qty,
      item_variant: [colorName, sizeName].filter(Boolean).join(' / '),
    }],
  })
}

export function trackBeginCheckout(items, total) {
  trackEvent('begin_checkout', {
    currency: 'TWD',
    value: total,
    items: items.map((i) => ({
      item_id: String(i.productId),
      item_name: i.productName,
      price: i.unitPrice,
      quantity: i.qty,
      item_variant: [i.colorName, i.sizeName].filter(Boolean).join(' / '),
    })),
  })
}

export function trackPurchase(orderNo, items, total) {
  trackEvent('purchase', {
    transaction_id: orderNo,
    currency: 'TWD',
    value: total,
    items: items.map((i) => ({
      item_id: String(i.ProductID ?? i.productId),
      item_name: i.ProductName ?? i.productName,
      price: i.UnitPrice ?? i.unitPrice,
      quantity: i.Qty ?? i.qty,
    })),
  })
}

export const gaEnabled = Boolean(GA_ID)
