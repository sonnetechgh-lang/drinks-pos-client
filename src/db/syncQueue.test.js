import { describe, it, expect, vi, beforeEach } from 'vitest'
import { addToQueue, flushQueue } from './syncQueue'
import { db } from './dexie'
import client from '../api/client'

vi.mock('./dexie', () => ({
  db: {
    syncQueue: {
      add: vi.fn(),
      toArray: vi.fn(),
      bulkDelete: vi.fn(),
      update: vi.fn(),
    },
    products: {
      bulkUpdate: vi.fn(),
    },
    customers: {
      update: vi.fn(),
    }
  }
}))

vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
  }
}))

describe('syncQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    db.syncQueue.toArray.mockResolvedValue([])
    
    const flush1 = flushQueue()
    const flush2 = flushQueue()
    
    expect(flush1).toBe(flush2)
    await flush1
  })

  it('should handle successful sync and clear queue', async () => {
    const mockSale = { id: 1, clientId: 'abc', total: 100, items: [] }
    db.syncQueue.toArray.mockResolvedValue([mockSale])
    client.post.mockResolvedValue({ data: { success: true } })
    
    await flushQueue()
    
    expect(client.post).toHaveBeenCalledWith('/sales/sync', { sales: [mockSale] })
    expect(db.syncQueue.bulkDelete).toHaveBeenCalledWith([1])
  })
})
