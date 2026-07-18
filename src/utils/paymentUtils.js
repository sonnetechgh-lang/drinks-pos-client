export const PAYMENT_OPTION_TEXT = 'Cash, Mobile Money, Credit, Advance Balance'

export const formatPaymentMethod = (method) => String(method || '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export const getPaymentLines = (sale) => {
  const lines = Array.isArray(sale?.paymentLines) && sale.paymentLines.length > 0
    ? sale.paymentLines
    : Array.isArray(sale?.payments)
      ? sale.payments
      : []

  return lines.map((line) => ({
    method: line.method,
    amount: Number(line.amount || 0),
    momoReference: line.momoReference || line.reference,
  }))
}

export const formatPaymentMethods = (sale) => {
  const methods = getPaymentLines(sale).map((line) => formatPaymentMethod(line.method)).filter(Boolean)
  return methods.length > 0 ? Array.from(new Set(methods)).join(', ') : 'Not recorded'
}
