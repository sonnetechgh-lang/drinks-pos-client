import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addToQueue, flushQueue } from './syncQueue'
import { db } from './dexie'
import client from '../api/client'

const syncedQueue = {
  equals: vi.fn(),
}

const idQueue = {
  anyOf: vi.fn(),
}

vi.mock('./dexie', () => ({
  db: {
    transaction: vi.fn(async (_mode, _table, callback) => callback()),
    syncQueue: {
      add: vi.fn(),
      where: vi.fn(),
      delete: vi.fn(),
    },
    products: {
      get: vi.fn(),
      update: vi.fn(),
    },
    customers: {
      where: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
      update: vi.fn(),
    }
  }
}))

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  }
}))

vi.mock('../api/products', () => ({
  getProducts: vi.fn(),
}))

describe('syncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncedQueue.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      modify: vi.fn().mockResolvedValue(undefined),
    })
    idQueue.anyOf.mockReturnValue({
      delete: vi.fn().mockResolvedValue(undefined),
      modify: vi.fn().mockResolvedValue(undefined),
    })
    db.syncQueue.where.mockImplementation((field) => {
      if (field === 'synced') return syncedQueue
      if (field === 'id') return idQueue
      return syncedQueue
    })
    db.customers.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
        first: vi.fn().mockResolvedValue(null),
      }),
    })
    client.post.mockResolvedValue({ data: { success: true, data: [] } })
  })

  it('should add a sale to the queue', async () => {
    const sale = { total: 100, items: [] }
    db.syncQueue.add.mockResolvedValue(1)
    
    await addToQueue(sale)
    
    expect(db.syncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
      total: 100,
      synced: 0,
    }))
  })

  it('should not allow concurrent flushes', async () => {
    const pending = new Promise((resolve) => setTimeout(resolve, 0))
    syncedQueue.equals.mockReturnValueOnce({
      toArray: vi.fn().mockResolvedValue([]),
    }).mockReturnValueOnce({
      toArray: vi.fn().mockImplementation(() => pending.then(() => [])),
    })
    
    const flush1 = flushQueue()
    const flush2 = flushQueue()
    
    expect(flush1).toBe(flush2)
    await flush1
  })

  it('should keep queued sale records shaped for sync', async () => {
    const mockSale = { id: 1, clientId: 'abc', total: 100, items: [] }
    const deleteSyncedSales = vi.fn().mockResolvedValue(undefined)
    syncedQueue.equals.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([mockSale]),
    })
    idQueue.anyOf.mockReturnValue({ delete: deleteSyncedSales, modify: vi.fn() })
    client.post.mockResolvedValue({ data: { success: true } })

    await addToQueue({ total: 100, items: [] })

    expect(db.syncQueue.add).toHaveBeenCalledWith(expect.objectContaining({
      total: 100,
      type: 'SALE',
      synced: 0,
      createdAt: expect.any(String),
    }))
  })
})
