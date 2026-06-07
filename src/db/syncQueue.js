import { db } from './dexie'
import client from '../api/client'
import { getProducts } from '../api/products'

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
  // Local ID in Dexie is the clientId (UUID string)
  record.id = record.clientId

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

  try {
    const response = await client.post('/v1/customers/sync', { customers: localCustomers })
    const syncedCustomers = response.data.data || []
    const idMap = new Map()

    for (const customer of syncedCustomers) {
      idMap.set(customer.clientId, customer.id)
      const local = localCustomers.find((item) => item.clientId === customer.clientId)
      if (local) {
        // Delete the record with UUID ID and replace with server ID
        await db.customers.delete(local.id)
        await db.customers.put({ ...local, id: customer.id, synced: 1 })
      }
    }

    return idMap
  } catch (err) {
    console.error('Failed to sync customers:', err.message)
    return new Map()
  }
}

const resolveCustomerIds = async (records, idMap) => {
  return Promise.all(records.map(async (record) => {
    // 1. Try to resolve via current session's sync map
    if (record.customerClientId) {
      const mappedId = idMap.get(record.customerClientId)
      if (mappedId) return { ...record, customerId: mappedId }
    }

    // 2. Try to resolve by looking up the local customer in Dexie
    if (record.customerClientId) {
      const localCustomer = await db.customers.where('clientId').equals(record.customerClientId).first()
      // Only use the ID if the customer is synced (has a server ID)
      if (localCustomer?.id && localCustomer.synced === 1) {
        return { ...record, customerId: localCustomer.id }
      }
    }

    // 3. If it already has a customerId, verify if it belongs to a synced customer
    if (record.customerId) {
      const customer = await db.customers.get(record.customerId)
      // If the customer exists locally and is NOT synced, it's a local UUID ID.
      // We should NOT send this local UUID as 'customerId' to the server.
      if (customer && customer.synced === 0) {
        return { ...record, customerId: undefined }
      }
      // If customer doesn't exist locally, assume it's a legacy server ID (if it exists)
      // or clear it if it's a UUID pattern (to be safe)
      if (!customer && typeof record.customerId === 'string' && record.customerId.includes('-')) {
         // Check if this UUID is in our customerClientId field just in case
         const byClientId = await db.customers.where('clientId').equals(record.customerId).first()
         if (byClientId && byClientId.synced === 1) {
           return { ...record, customerId: byClientId.id }
         }
         if (byClientId && byClientId.synced === 0) {
           return { ...record, customerId: undefined }
         }
      }
    }

    return record
  }))
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
    // Filter out payments that don't have a server customerId yet
    const readyPayments = payments.filter((p) => p.customerId)
    
    if (readyPayments.length > 0) {
      try {
        const response = await client.post('/v1/customer-payments/sync', { payments: readyPayments })
        if (response.data.success) {
          await db.syncQueue.where('id').anyOf(readyPayments.map((p) => p.id)).delete()
        }
      } catch (err) {
        await db.syncQueue.where('id').anyOf(readyPayments.map((p) => p.id)).modify((p) => {
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
    
    // Filter out sales that need a customer but don't have one yet
    const readySales = sales.filter((s) => {
      const isCredit = s.paymentStatus === 'CREDIT' || s.paymentStatus === 'PARTIAL'
      const usesAdvance = s.paymentLines?.some(l => l.method === 'ADVANCE_BALANCE')
      if ((isCredit || usesAdvance) && !s.customerId) return false
      return true
    })

    if (readySales.length > 0) {
      try {
        const response = await client.post('/v1/sales/sync', { sales: readySales })
        if (response.data.success) {
          await db.syncQueue.where('id').anyOf(readySales.map((s) => s.id)).delete()
          
          // Refresh products from server to update Dexie stock levels
          try {
            await getProducts()
          } catch (pErr) {
            console.warn('Failed to refresh products after sales sync:', pErr.message)
          }
        }
      } catch (err) {
        await db.syncQueue.where('id').anyOf(readySales.map((s) => s.id)).modify((s) => {
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

export const flushQueue = () => {
  if (activeFlush) return activeFlush

  activeFlush = runFlushQueue().finally(() => {
    activeFlush = null
  })

  return activeFlush
}
