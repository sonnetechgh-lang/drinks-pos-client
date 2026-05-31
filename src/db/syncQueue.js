import { db } from './dexie'
import client from '../api/client'

export const addCustomerToQueue = async (customer) => {
  const record = {
    ...customer,
    clientId: customer.clientId || crypto.randomUUID(),
    synced: false,
    active: customer.active !== undefined ? customer.active : true,
    createdAt: new Date().toISOString(),
  }
  record.id = customer.id || record.clientId

  await db.customers.put(record)

  try {
    await flushQueue()
  } catch (err) {
    console.warn('Customer sync failed, customer remains local for later.')
  }

  return record
}

/**
 * Adds a sale to the local sync queue and attempts to push to server.
 */
export const addToQueue = async (sale) => {
  const saleRecord = {
    ...sale,
    synced: false,
    type: 'SALE',
    createdAt: new Date().toISOString()
  }
  
  // 1. Write to local Dexie immediately
  await db.syncQueue.add(saleRecord)
  
  // 2. Attempt background sync
  try {
    await flushQueue()
  } catch (err) {
    console.warn('Sync failed, sale remains in queue for later.')
  }
}

export const addCustomerPaymentToQueue = async (payment) => {
  const paymentRecord = {
    ...payment,
    clientId: payment.clientId || crypto.randomUUID(),
    synced: false,
    type: 'CUSTOMER_PAYMENT',
    createdAt: payment.createdAt || new Date().toISOString(),
  }

  await db.syncQueue.add(paymentRecord)

  try {
    await flushQueue()
  } catch (err) {
    console.warn('Payment sync failed, payment remains in queue for later.')
  }

  return paymentRecord
}

const syncLocalCustomers = async () => {
  const localCustomers = await db.customers.where('synced').equals(0).toArray()
  if (localCustomers.length === 0) return new Map()

  const response = await client.post('/v1/customers/sync', { customers: localCustomers })
  const syncedCustomers = response.data.data || []
  const idMap = new Map()

  for (const customer of syncedCustomers) {
    idMap.set(customer.clientId, customer.id)
    const local = localCustomers.find((item) => item.clientId === customer.clientId)
    if (local) {
      await db.customers.delete(local.id)
      await db.customers.put({ ...local, id: customer.id, synced: 1 })
    }
  }

  return idMap
}

const resolveCustomerIds = async (records, idMap) => {
  return Promise.all(records.map(async (record) => {
    if (record.customerId) return record
    if (!record.customerClientId) return record

    const mappedId = idMap.get(record.customerClientId)
    if (mappedId) return { ...record, customerId: mappedId }

    const localCustomer = await db.customers.where('clientId').equals(record.customerClientId).first()
    return localCustomer?.id ? { ...record, customerId: localCustomer.id } : record
  }))
}

/**
 * Pushes all unsynced customers, payments, and sales to the server.
 */
export const flushQueue = async () => {
  const customerIdMap = await syncLocalCustomers()
  const unsynced = await db.syncQueue.where('synced').equals(0).toArray()
  
  if (unsynced.length === 0) return

  try {
    const payments = await resolveCustomerIds(
      unsynced.filter((record) => record.type === 'CUSTOMER_PAYMENT'),
      customerIdMap
    )
    if (payments.length > 0) {
      const response = await client.post('/v1/customer-payments/sync', { payments })
      if (response.data.success) {
        await db.syncQueue.where('id').anyOf(payments.map((payment) => payment.id)).modify({ synced: 1 })
      }
    }

    const sales = await resolveCustomerIds(
      unsynced.filter((record) => !record.type || record.type === 'SALE'),
      customerIdMap
    )
    if (sales.length > 0) {
      const response = await client.post('/v1/sales/sync', { sales })
      if (response.data.success) {
        await db.syncQueue.where('id').anyOf(sales.map((sale) => sale.id)).modify({ synced: 1 })
      }
    }
  } catch (error) {
    console.error('Failed to flush sync queue:', error.message)
    throw error
  }
}
