import { businessDetails } from '../config/business'

export const formatCurrency = (value, { currency = businessDetails.currency } = {}) => {
  const amount = Number(value || 0)
  const normalizedAmount = Number.isFinite(amount) ? amount : 0

  return `${currency}${normalizedAmount.toFixed(2)}`
}

