import client from './client'
import { db } from '../db/dexie'

export const normalizeCustomer = (customer) => {
  const balance = Number(customer?.currentBalance ?? customer?.balance ?? 0)
  return {
    ...customer,
    currentBalance: balance,
    balance,
  }
}

export const getCustomers = async (search) => {
  const response = await client.get('/v1/customers', {
    params: { search }
  })
  const customers = Array.isArray(response.data.data)
    ? response.data.data.map(normalizeCustomer)
    : response.data.data
  if (Array.isArray(customers)) {
    await db.customers.bulkPut(customers.map((customer) => ({ ...customer, synced: 1 })))
  }
  return customers
}

// Dashboard: Top debtors
export const getTopDebtors = async (limit = 5) => {
  const response = await client.get('/v1/customers/top-debtors', { params: { limit } })
  return response.data.data
}

export const updateCustomer = async (id, customerData) => {
  const response = await client.patch(`/v1/customers/${id}`, customerData)
  return normalizeCustomer(response.data.data)
}

export const getCustomerBalance = async (customerId) => {
  const response = await client.get(`/v1/customers/${customerId}/balance`)
  return response.data.data
}

export const getCustomerLedger = async (customerId) => {
  const response = await client.get(`/v1/customers/${customerId}/ledger`)
  return response.data.data
}

export const createCustomer = async (customerData) => {
  const response = await client.post('/v1/customers', customerData)
  return normalizeCustomer(response.data.data)
}

export const syncCustomers = async (customers) => {
  const response = await client.post('/v1/customers/sync', { customers })
  return response.data.data
}
