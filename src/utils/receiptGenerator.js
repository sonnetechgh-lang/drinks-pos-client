import { defaultReceiptSettings, legacyReceiptDefaults } from '../config/business'

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const formatMoney = (value, currency) => `${currency}${Number(value || 0).toFixed(2)}`

const formatMethod = (method) => String(method || '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

const getReceiptSettings = () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem('palace-line-settings')
      || localStorage.getItem('drinks-pos-settings')
      || '{}'
    )
    const settings = { ...defaultReceiptSettings, ...saved }

    if (!saved.address || saved.address === legacyReceiptDefaults.address) {
      settings.address = defaultReceiptSettings.address
    }

    return settings
  } catch {
    return defaultReceiptSettings
  }
}

const buildReceiptHtml = (sale, settings) => {
  const shopName = settings.shopName || defaultReceiptSettings.shopName
  const address = settings.address === legacyReceiptDefaults.receiptAddress
    ? defaultReceiptSettings.address
    : settings.address || defaultReceiptSettings.address
  const email = settings.email || defaultReceiptSettings.email
  const phone = settings.phone || defaultReceiptSettings.phone
  const footerText = settings.footerText || defaultReceiptSettings.footerText
  const currency = settings.currency || defaultReceiptSettings.currency
  const paperWidth = settings.paperWidth || 80
  const receiptId = sale.clientId ? sale.clientId.slice(0, 8).toUpperCase() : 'SALE'
  const date = sale.createdAt ? new Date(sale.createdAt) : new Date()
  const paid = Number(sale.amountPaid || 0)
  const change = Math.max(0, paid - Number(sale.total || 0))

  const rows = (sale.items || []).map((item) => {
    const itemName = item.productName || item.name || item.packageName || 'Item'
    const packageName = item.packageName && item.packageName !== itemName ? item.packageName : ''
    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unitPrice || 0)
    const lineTotal = quantity * unitPrice

    return `
      <div class="item">
        <div class="item-name">${escapeHtml(itemName)}</div>
        ${packageName ? `<div class="muted">${escapeHtml(packageName)}</div>` : ''}
        <div class="item-line">
          <span>${quantity} x ${formatMoney(unitPrice, currency)}</span>
          <strong>${formatMoney(lineTotal, currency)}</strong>
        </div>
      </div>
    `
  }).join('')

  const payments = (sale.paymentLines || []).map((line) => `
    <div class="summary-row">
      <span>${escapeHtml(formatMethod(line.method))}</span>
      <span>${formatMoney(line.amount, currency)}</span>
    </div>
    ${line.momoReference ? `<div class="muted right">Ref: ${escapeHtml(line.momoReference)}</div>` : ''}
  `).join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt ${escapeHtml(receiptId)}</title>
    <style>
      @page {
        size: ${paperWidth}mm 297mm;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #fff;
        color: #000;
        font-family: "Courier New", Courier, monospace, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        -webkit-print-color-adjust: exact;
      }

      .receipt {
        width: ${paperWidth}mm;
        min-height: 100%;
        padding: 4mm 6mm;
        margin: 0 auto;
      }

      .center {
        text-align: center;
      }

      .right {
        text-align: right;
      }

      .shop-name {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.2;
        text-transform: uppercase;
        margin-bottom: 2mm;
      }

      .address,
      .muted {
        color: #000;
        font-size: 11px;
        font-weight: 500;
      }

      .divider {
        border-top: 1px dashed #000;
        margin: 8px 0;
      }

      .meta-row,
      .summary-row,
      .item-line {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin: 2px 0;
      }

      /* Fallback for when flex-space-between is too tight */
      .meta-row span:first-child::after,
      .summary-row span:first-child::after {
        content: ":";
      }

      .item {
        break-inside: avoid;
        padding: 4px 0;
      }

      .item-name {
        font-weight: 700;
        overflow-wrap: anywhere;
        text-transform: uppercase;
      }

      .total {
        font-size: 16px;
        font-weight: 900;
        border-top: 1px solid #000;
        padding-top: 4px;
        margin-top: 4px;
      }

      .footer {
        margin-top: 15px;
        font-weight: 700;
        font-size: 11px;
      }

      @media print {
        body {
          width: ${paperWidth}mm;
        }

        .receipt {
          padding: 4mm 5mm;
        }
      }
    </style>
  </head>
  <body>
    <main class="receipt">
      <header class="center">
        <div class="shop-name">${escapeHtml(shopName)}</div>
        <div class="address">${escapeHtml(address)}</div>
        <div class="address">${escapeHtml(phone)}</div>
        ${email ? `<div class="address">${escapeHtml(email)}</div>` : ''}
      </header>

      <div class="divider"></div>

      <section>
        <div class="meta-row"><span>Date</span> <span>${escapeHtml(date.toLocaleString())}</span></div>
        <div class="meta-row"><span>Receipt</span> <span>${escapeHtml(receiptId)}</span></div>
        ${sale.customerName ? `<div class="meta-row"><span>Customer</span> <span>${escapeHtml(sale.customerName)}</span></div>` : ''}
        ${sale.cashierName ? `<div class="meta-row"><span>Cashier</span> <span>${escapeHtml(sale.cashierName)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <section>
        ${rows}
      </section>

      <div class="divider"></div>

      <section>
        ${Number(sale.discount || 0) > 0 ? `
          <div class="summary-row"><span>Subtotal</span> <span>${formatMoney(Number(sale.total || 0) + Number(sale.discount || 0), currency)}</span></div>
          <div class="summary-row"><span>Discount</span> <span>-${formatMoney(sale.discount, currency)}</span></div>
        ` : ''}
        <div class="summary-row total"><span>Total</span> <span>${formatMoney(sale.total, currency)}</span></div>
        ${payments}
        ${change > 0 ? `<div class="summary-row"><span>Change</span> <span>${formatMoney(change, currency)}</span></div>` : ''}
        ${Number(sale.creditAmount || 0) > 0 ? `<div class="summary-row"><span>Amount Owed</span> <span>${formatMoney(sale.creditAmount, currency)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <footer class="center footer">
        ${escapeHtml(footerText)}
      </footer>
    </main>
  </body>
</html>`
}

const getReceiptBody = (receiptHtml) => {
  const parsed = new DOMParser().parseFromString(receiptHtml, 'text/html')
  return parsed.querySelector('.receipt')?.outerHTML || receiptHtml
}

const printInCurrentPage = (receiptHtml) => {
  const settings = getReceiptSettings()
  const paperWidth = settings.paperWidth || 80
  
  let printRoot = document.getElementById('receipt-print-root')
  let printStyle = document.getElementById('receipt-print-style')

  if (!printRoot) {
    printRoot = document.createElement('div')
    printRoot.id = 'receipt-print-root'
    document.body.appendChild(printRoot)
  }

  if (!printStyle) {
    printStyle = document.createElement('style')
    printStyle.id = 'receipt-print-style'
    document.head.appendChild(printStyle)
  }

  printRoot.innerHTML = getReceiptBody(receiptHtml)
  printStyle.textContent = `
    #receipt-print-root { display: none; }
    @media print {
      @page { size: ${paperWidth}mm 297mm; margin: 0; }
      body > *:not(#receipt-print-root) { display: none !important; }
        #receipt-print-root {
          display: block !important;
          width: ${paperWidth}mm;
          margin: 0;
          background: #fff;
          color: #000;
          font-family: "Courier New", Courier, monospace, Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
        }
      #receipt-print-root .receipt {
        width: ${paperWidth}mm;
        padding: 4mm 5mm;
      }
    }
  `

  window.setTimeout(() => {
    window.print()
  }, 150)
}

const printInNewWindow = (receiptHtml) => {
  try {
    const printWindow = window.open('', '_blank', 'width=350,height=600')
    if (!printWindow) {
      throw new Error('Popup blocked')
    }
    printWindow.document.write(receiptHtml)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  } catch (err) {
    console.warn('Popup blocked or failed, using current-page printing fallback:', err)
    printInCurrentPage(receiptHtml)
  }
}

export const getReceiptHtml = (sale) => {
  const settings = getReceiptSettings()
  return buildReceiptHtml(sale, settings)
}

export const printReceipt = (sale) => {
  const receiptHtml = getReceiptHtml(sale)

  printInNewWindow(receiptHtml)
  return true
}

export const generateReceipt = printReceipt
