import { defaultReceiptSettings, legacyReceiptDefaults } from '../config/business'

const RECEIPT_WIDTH_MM = 80

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
        size: ${RECEIPT_WIDTH_MM}mm 297mm;
        margin: 0;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #fff;
        color: #000;
        font-family: "Courier New", Courier, monospace;
        font-size: 11px;
        line-height: 1.35;
      }

      .receipt {
        width: ${RECEIPT_WIDTH_MM}mm;
        min-height: 100%;
        padding: 4mm;
      }

      .center {
        text-align: center;
      }

      .right {
        text-align: right;
      }

      .shop-name {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.2;
        text-transform: uppercase;
      }

      .address,
      .muted {
        color: #111;
        font-size: 10px;
      }

      .divider {
        border-top: 1px dashed #000;
        margin: 7px 0;
      }

      .meta-row,
      .summary-row,
      .item-line {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .meta-row span:first-child,
      .summary-row span:first-child,
      .item-line span:first-child {
        min-width: 0;
      }

      .item {
        break-inside: avoid;
        padding: 4px 0;
      }

      .item-name {
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .summary-row {
        margin: 3px 0;
      }

      .total {
        font-size: 14px;
        font-weight: 700;
      }

      .footer {
        margin-top: 10px;
        font-weight: 700;
      }

      .print-actions {
        display: flex;
        gap: 8px;
        padding: 8px;
        background: #f3f4f6;
        border-bottom: 1px solid #d1d5db;
        font-family: Arial, sans-serif;
      }

      .print-actions button {
        border: 1px solid #111827;
        background: #111827;
        color: #fff;
        border-radius: 4px;
        padding: 8px 10px;
        font-size: 12px;
        cursor: pointer;
      }

      .print-actions button.secondary {
        background: #fff;
        color: #111827;
      }

      @media print {
        body {
          width: ${RECEIPT_WIDTH_MM}mm;
        }

        .print-actions {
          display: none;
        }

        .receipt {
          padding: 3mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-actions">
      <button type="button" onclick="window.print()">Print</button>
      <button type="button" class="secondary" onclick="window.close()">Close</button>
    </div>

    <main class="receipt">
      <header class="center">
        <div class="shop-name">${escapeHtml(shopName)}</div>
        <div class="address">${escapeHtml(address)}</div>
        <div class="address">${escapeHtml(phone)}</div>
        <div class="address">${escapeHtml(email)}</div>
      </header>

      <div class="divider"></div>

      <section>
        <div class="meta-row"><span>Date</span><span>${escapeHtml(date.toLocaleString())}</span></div>
        <div class="meta-row"><span>Receipt</span><span>${escapeHtml(receiptId)}</span></div>
        ${sale.customerName ? `<div class="meta-row"><span>Customer</span><span>${escapeHtml(sale.customerName)}</span></div>` : ''}
        ${sale.cashierName ? `<div class="meta-row"><span>Cashier</span><span>${escapeHtml(sale.cashierName)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <section>
        ${rows}
      </section>

      <div class="divider"></div>

      <section>
        ${Number(sale.discount || 0) > 0 ? `
          <div class="summary-row"><span>Subtotal</span><span>${formatMoney(Number(sale.total || 0) + Number(sale.discount || 0), currency)}</span></div>
          <div class="summary-row"><span>Discount</span><span>-${formatMoney(sale.discount, currency)}</span></div>
        ` : ''}
        <div class="summary-row total"><span>Total</span><span>${formatMoney(sale.total, currency)}</span></div>
        ${payments}
        ${change > 0 ? `<div class="summary-row"><span>Change</span><span>${formatMoney(change, currency)}</span></div>` : ''}
        ${Number(sale.creditAmount || 0) > 0 ? `<div class="summary-row"><span>Amount Owed</span><span>${formatMoney(sale.creditAmount, currency)}</span></div>` : ''}
      </section>

      <div class="divider"></div>

      <footer class="center footer">
        ${escapeHtml(footerText)}
      </footer>
    </main>

  </body>
</html>`
}

const printFromFrame = (receiptHtml) => {
  const frame = document.createElement('iframe')
  frame.title = 'Receipt print preview'
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = `${RECEIPT_WIDTH_MM}mm`
  frame.style.height = '1px'
  frame.style.border = '0'
  frame.style.opacity = '0'
  frame.style.pointerEvents = 'none'

  document.body.appendChild(frame)

  const frameWindow = frame.contentWindow
  const frameDocument = frame.contentDocument || frameWindow?.document

  if (!frameWindow || !frameDocument) {
    frame.remove()
    return false
  }

  frameDocument.open()
  frameDocument.write(receiptHtml)
  frameDocument.close()

  const cleanup = () => {
    window.setTimeout(() => frame.remove(), 500)
  }

  frameWindow.addEventListener('afterprint', cleanup, { once: true })

  frameWindow.focus()
  frameWindow.print()
  window.setTimeout(cleanup, 3000)

  return true
}

const printFromPopup = (receiptHtml) => {
  const printWindow = window.open('', 'receipt-print', 'width=380,height=720')

  if (!printWindow) {
    return false
  }

  printWindow.document.open()
  printWindow.document.write(receiptHtml)
  printWindow.document.close()

  window.setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 150)

  return true
}

export const generateReceipt = (sale) => {
  const settings = getReceiptSettings()
  const receiptHtml = buildReceiptHtml(sale, settings)

  if (!printFromFrame(receiptHtml) && !printFromPopup(receiptHtml)) {
    alert('Receipt printing could not start. Please allow popups and try again.')
    return false
  }

  return true
}
