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

const getReceiptCss = (paperWidth, { includePrintBlock = true } = {}) => {
  const sidePadding = paperWidth <= 58 ? 3 : 4
  const topPadding = 6
  const bottomPadding = 18

  return `
      @page {
        size: ${paperWidth}mm auto;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${paperWidth}mm;
        min-width: ${paperWidth}mm;
        max-width: ${paperWidth}mm;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1.35;
      }

      .receipt {
        display: block;
        width: ${paperWidth}mm;
        min-width: ${paperWidth}mm;
        max-width: ${paperWidth}mm;
        padding: ${topPadding}mm ${sidePadding}mm ${bottomPadding}mm ${sidePadding}mm;
        margin: 0;
        overflow: hidden;
      }

      .center {
        text-align: center;
      }

      .right {
        text-align: right;
      }

      .shop-name {
        font-size: ${paperWidth <= 58 ? 15 : 18}px;
        font-weight: 900;
        line-height: 1.18;
        text-transform: uppercase;
        margin-bottom: 2mm;
        overflow-wrap: anywhere;
      }

      .address,
      .muted {
        color: #000;
        font-size: ${paperWidth <= 58 ? 10 : 11}px;
        font-weight: 500;
        overflow-wrap: anywhere;
      }

      .divider {
        display: block;
        width: 100%;
        margin: 7px 0;
        overflow: hidden;
        white-space: nowrap;
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1;
      }

      .divider::before {
        content: "------------------------------------------------------------";
      }

      .meta-row,
      .summary-row,
      .item-line {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        column-gap: 8px;
        align-items: start;
        margin: 2px 0;
      }

      .meta-row > :first-child,
      .summary-row > :first-child,
      .item-line > :first-child {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .meta-row > :last-child,
      .summary-row > :last-child,
      .item-line > :last-child {
        text-align: right;
        white-space: nowrap;
      }

      .item {
        break-inside: avoid;
        page-break-inside: avoid;
        padding: 4px 0;
      }

      .item-name {
        font-weight: 700;
        overflow-wrap: anywhere;
        text-transform: uppercase;
      }

      .total {
        font-size: ${paperWidth <= 58 ? 14 : 16}px;
        font-weight: 900;
        padding-top: 4px;
        margin-top: 4px;
      }

      .total::before {
        content: "";
        grid-column: 1 / -1;
        border-top: 1px solid #000;
        margin-bottom: 4px;
      }

      .footer {
        margin-top: 15px;
        font-weight: 700;
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .developer-credit {
        margin-top: 8px;
        font-size: 9px;
        font-weight: 400;
        color: #000;
        padding-top: 6px;
        overflow-wrap: anywhere;
      }

      .developer-credit::before {
        content: "------------------------------";
        display: block;
        margin-bottom: 6px;
        overflow: hidden;
        white-space: nowrap;
      }

      ${includePrintBlock ? `@media print {
        html,
        body,
        .receipt {
          width: ${paperWidth}mm !important;
          min-width: ${paperWidth}mm !important;
          max-width: ${paperWidth}mm !important;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
        }

        .receipt {
          margin: 0 !important;
          padding: ${topPadding}mm ${sidePadding}mm ${bottomPadding}mm ${sidePadding}mm !important;
        }
      }` : ''}
    `
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
      ${getReceiptCss(paperWidth)}
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
        <div class="meta-row"><span>Date:</span> <span>${escapeHtml(date.toLocaleString())}</span></div>
        <div class="meta-row"><span>Receipt:</span> <span>${escapeHtml(receiptId)}</span></div>
        ${sale.customerName ? `<div class="meta-row"><span>Customer:</span> <span>${escapeHtml(sale.customerName)}</span></div>` : ''}
        ${sale.cashierName ? `<div class="meta-row"><span>Cashier:</span> <span>${escapeHtml(sale.cashierName)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <section>
        ${rows}
      </section>

      <div class="divider"></div>

      <section>
        ${Number(sale.discount || 0) > 0 ? `
          <div class="summary-row"><span>Subtotal:</span> <span>${formatMoney(Number(sale.total || 0) + Number(sale.discount || 0), currency)}</span></div>
          <div class="summary-row"><span>Discount:</span> <span>-${formatMoney(sale.discount, currency)}</span></div>
        ` : ''}
        <div class="summary-row total"><span>Total:</span> <span>${formatMoney(sale.total, currency)}</span></div>
        ${payments}
        ${change > 0 ? `<div class="summary-row"><span>Change:</span> <span>${formatMoney(change, currency)}</span></div>` : ''}
        ${Number(sale.creditAmount || 0) > 0 ? `<div class="summary-row"><span>Amount Owed:</span> <span>${formatMoney(sale.creditAmount, currency)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <footer class="center">
        <div class="footer">${escapeHtml(footerText)}</div>
        <div class="developer-credit">
          Developed by Sonnet Solutions<br/>
          (0257940113 / 0545489242)
        </div>
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
      body > *:not(#receipt-print-root) { display: none !important; }
      ${getReceiptCss(paperWidth, { includePrintBlock: false })}
      #receipt-print-root { display: block !important; }
    }
  `

  window.setTimeout(() => {
    window.print()
  }, 150)
}

const printInNewWindow = (receiptHtml) => {
  try {
    const printWindow = window.open('', '_blank', 'width=380,height=650')
    if (!printWindow) {
      throw new Error('Popup blocked')
    }
    printWindow.document.write(receiptHtml)
    printWindow.document.close()
    printWindow.focus()

    const closeAfterPrint = () => {
      printWindow.removeEventListener?.('afterprint', closeAfterPrint)
      printWindow.close()
    }

    printWindow.addEventListener?.('afterprint', closeAfterPrint)
    setTimeout(() => {
      printWindow.print()
    }, 500)
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
