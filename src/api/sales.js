import client from './client'

export const getSalesSummary = async () => {
  const response = await client.get('/v1/sales/summary')
  return response.data.data
}

// Dashboard: Today's sales (limited list)
export const getTodaySales = async (limit = 5) => {
  const response = await client.get('/v1/sales/today', { params: { limit } })
  return response.data.data
}

// Dashboard: Today's total sales
export const getTodayTotal = async () => {
  const response = await client.get('/v1/sales/today/total')
  return response.data.data
}

// Dashboard: Best selling products
export const getBestSellingProducts = async (limit = 5) => {
  const response = await client.get('/v1/sales/best-selling', { params: { limit } })
  return response.data.data
}

// Dashboard: Outstanding credit total
export const getOutstandingCredit = async () => {
  const response = await client.get('/v1/sales/outstanding-credit/total')
  return response.data.data
}

// Reports: Sales by date range
export const getSalesReport = async (startDate, endDate, paymentStatus, limit = 50, offset = 0) => {
  const toDayBoundary = (value, boundary) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (boundary === 'end') date.setHours(23, 59, 59, 999)
    return date.toISOString()
  }

  const response = await client.get('/v1/sales/reports', {
    params: {
      startDate: toDayBoundary(startDate, 'start'),
      endDate: toDayBoundary(endDate, 'end'),
      paymentStatus,
      limit,
      offset,
    }
  })
  return response.data
}
