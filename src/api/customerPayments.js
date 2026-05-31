import client from './client'

export const getCustomerPayments = async () => {
  const response = await client.get('/v1/customer-payments')
  return response.data.data
}

export const createCustomerPayment = async (paymentData) => {
  const response = await client.post('/v1/customer-payments', paymentData)
  return response.data.data
}

export const syncCustomerPayments = async (payments) => {
  const response = await client.post('/v1/customer-payments/sync', { payments })
  return response.data.data
}
