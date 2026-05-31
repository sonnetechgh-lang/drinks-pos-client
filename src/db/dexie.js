import Dexie from 'dexie'

export const db = new Dexie('PalaceLinePOS')

db.version(1).stores({
  products: 'id, name, categoryId',
  syncQueue: '++id, clientId, createdAt, synced'
})

db.version(2).stores({
  products: 'id, name, categoryId',
  customers: 'id, clientId, name, phone, active, synced',
  syncQueue: '++id, clientId, createdAt, synced, type'
})
