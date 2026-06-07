import client from './client'

export const getPayments = async () => {
  const response = await client.get('/v1/customer-payments')
  return response.data.data
}
