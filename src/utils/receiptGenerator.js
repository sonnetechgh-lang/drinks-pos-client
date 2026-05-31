import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export const generateReceipt = (sale) => {
  const doc = new jsPDF({
    unit: 'mm',
    format: [80, 150] // Typical thermal receipt size (80mm width)
  })

  const settings = JSON.parse(localStorage.getItem('palace-line-settings') || localStorage.getItem('drinks-pos-settings') || '{}')
  const shopName = settings.shopName || 'Palace Line Enterprise'
  const address = settings.address || 'Accra, Ghana'
  const footerText = settings.footerText || 'THANK YOU!'
  const currency = settings.currency || 'GH₵'

  // Header
  doc.setFontSize(12)
  doc.text(shopName, 40, 10, { align: 'center' })
  doc.setFontSize(8)
  doc.text(address, 40, 15, { align: 'center' })
  doc.line(5, 20, 75, 20)

  // Sale Info
  doc.text(`Date: ${new Date(sale.createdAt).toLocaleString()}`, 5, 25)
  doc.text(`Receipt: ${sale.clientId.slice(0, 8).toUpperCase()}`, 5, 30)
  if (sale.customerName) {
    doc.text(`Customer: ${sale.customerName}`, 5, 35)
  }
  doc.line(5, sale.customerName ? 38 : 33, 75, sale.customerName ? 38 : 33)

  // Items Table
  const tableData = sale.items.map(item => [
    `${item.packageName || 'Unit'} ${item.name || 'Item'}`,
    item.quantity.toString(),
    `${currency}${item.unitPrice.toFixed(2)}`,
    `${currency}${(item.quantity * item.unitPrice).toFixed(2)}`
  ])

  doc.autoTable({
    startY: sale.customerName ? 40 : 35,
    margin: { left: 5, right: 5 },
    body: tableData,
    columns: [
      { header: 'Item', dataKey: 0 },
      { header: 'Qty', dataKey: 1 },
      { header: 'Price', dataKey: 2 },
      { header: 'Total', dataKey: 3 }
    ],
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    theme: 'plain'
  })

  // Totals
  const finalY = doc.previousAutoTable.finalY + 5
  doc.line(40, finalY, 75, finalY)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL:', 45, finalY + 5)
  doc.text(`${currency}${sale.total.toFixed(2)}`, 75, finalY + 5, { align: 'right' })

  let paymentY = finalY + 11
  if (sale.paymentLines?.length) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    sale.paymentLines.forEach((line) => {
      doc.text(`${line.method.replace('_', ' ')}:`, 45, paymentY)
      doc.text(`${currency}${Number(line.amount).toFixed(2)}`, 75, paymentY, { align: 'right' })
      paymentY += 5
    })
  }

  if (sale.creditAmount > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('AMOUNT OWED:', 45, paymentY)
    doc.text(`${currency}${Number(sale.creditAmount).toFixed(2)}`, 75, paymentY, { align: 'right' })
    paymentY += 5
  }

  // Footer
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(footerText, 40, paymentY + 5, { align: 'center' })

  // Save/Download
  doc.save(`Receipt-${sale.clientId.slice(0, 8)}.pdf`)
}
