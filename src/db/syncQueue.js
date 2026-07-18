import { db } from './dexie'
import client from '../api/client'
import { getProducts } from '../api/products'
import { getCustomers } from '../api/customers'

let activeFlush = null

const getSaleItemQuantity = (item) => {
  const quantity = Number(item.baseQuantity ?? item.quantity ?? 0)
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

const applyLocalSaleStock = async (sale) => {
  const items = sale.items || []
  if (items.length === 0) return

  await db.transaction('rw', db.products, async () => {
    for (const item of items) {
      if (!item.productId) continue
      const product = await db.products.get(item.productId)
      if (!product) continue

      const nextStock = Math.max(0, Number(product.stock || 0) - getSaleItemQuantity(item))
      await db.products.update(item.productId, { stock: nextStock })
    }
  })
}

export const addCustomerToQueue = async (customer) => {
  const record = {
    ...customer,
    clientId: customer.clientId || crypto.randomUUID(),
    synced: 0,
    active: customer.active !== undefined ? customer.active : true,
    createdAt: new Date().toISOString(),
  }
  record.id = customer.id || record.clientId

  await db.customers.put(record)

  try {
    await flushQueue()
  } catch {
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
    synced: 0,
    type: 'SALE',
    createdAt: new Date().toISOString()
  }
  
  // 1. Write to local Dexie immediately
  await db.syncQueue.add(saleRecord)
  await applyLocalSaleStock(saleRecord)
  
  // 2. Attempt background sync
  try {
    await flushQueue()
    return { sale: saleRecord, synced: true }
  } catch (err) {
    const message = err.response?.data?.message || err.message || 'Sync failed.'
    console.warn('Sync failed, sale remains in queue for later.')
    return { sale: saleRecord, synced: false, message }
  }
}

export const addCustomerPaymentToQueue = async (payment) => {
  const paymentRecord = {
    ...payment,
    clientId: payment.clientId || crypto.randomUUID(),
    synced: 0,
    type: 'CUSTOMER_PAYMENT',
    createdAt: payment.createdAt || new Date().toISOString(),
  }

  await db.syncQueue.add(paymentRecord)

  try {
    await flushQueue()
  } catch {
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

const refreshCustomers = async () => {
  try {
    await getCustomers()
  } catch (err) {
    console.warn('Failed to refresh customers after sync:', err.message)
  }
}

/**
 * Pushes all unsynced customers, payments, and sales to the server.
 */
const runFlushQueue = async () => {
  const customerIdMap = await syncLocalCustomers()
  const unsynced = await db.syncQueue.where('synced').equals(0).toArray()
  
  if (unsynced.length === 0) return

  try {
    const payments = await resolveCustomerIds(
      unsynced.filter((record) => record.type === 'CUSTOMER_PAYMENT'),
      customerIdMap
    )
    if (payments.length > 0) {
      try {
        const response = await client.post('/v1/customer-payments/sync', { payments })
        if (response.data.success) {
          await db.syncQueue.where('id').anyOf(payments.map((p) => p.id)).delete()
          await refreshCustomers()
        }
      } catch (err) {
        await db.syncQueue.where('id').anyOf(payments.map((p) => p.id)).modify((p) => {
          p.attempts = (p.attempts || 0) + 1
          p.lastError = err.response?.data?.message || err.message
        })
        throw err
      }
    }

    const sales = await resolveCustomerIds(
      unsynced.filter((record) => !record.type || record.type === 'SALE'),
      customerIdMap
    )
    if (sales.length > 0) {
      try {
        const response = await client.post('/v1/sales/sync', { sales })
        if (response.data.success) {
          await db.syncQueue.where('id').anyOf(sales.map((s) => s.id)).delete()
          
          // Refresh products from server to update Dexie stock levels
          try {
            await getProducts()
          } catch (pErr) {
            console.warn('Failed to refresh products after sales sync:', pErr.message)
          }
          await refreshCustomers()
        }
      } catch (err) {
        await db.syncQueue.where('id').anyOf(sales.map((s) => s.id)).modify((s) => {
          s.attempts = (s.attempts || 0) + 1
          s.lastError = err.response?.data?.message || err.message
        })
        throw err
      }
    }
  } catch (error) {
    console.error('Failed to flush sync queue:', error.message)
    throw error
  }
}

export const flushQueue = async () => {
  if (activeFlush) return activeFlush

  activeFlush = runFlushQueue().finally(() => {
    activeFlush = null
  })

  return activeFlush
}
