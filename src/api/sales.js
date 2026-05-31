import client from './client'

export const getSalesSummary = async () => {
  const response = await client.get('/v1/sales/summary')
  return response.data.data
}
