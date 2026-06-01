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
  const response = await client.get('/v1/sales/reports', {
    params: { startDate, endDate, paymentStatus, limit, offset }
  })
  return response.data.data
}
