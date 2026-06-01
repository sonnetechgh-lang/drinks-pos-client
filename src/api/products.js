import client from './client'
import { db } from '../db/dexie'

export const getProducts = async () => {
  const response = await client.get('/v1/products')
  const products = response.data.data
  
  // Sync with Dexie
  if (products && Array.isArray(products)) {
    await db.products.clear()
    await db.products.bulkAdd(products.map(p => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      price: p.price,
      stock: p.stock,
      baseUnit: p.baseUnit,
      category: p.category,
      packageOptions: p.packageOptions || [],
    })))
  }
  
  return products
}

// Dashboard: Product count
export const getProductCount = async () => {
  const response = await client.get('/v1/products/count')
  return response.data.data
}

// Dashboard: Low stock items
export const getLowStockProducts = async (limit = 8) => {
  const response = await client.get('/v1/products/low-stock', { params: { limit } })
  return response.data.data
}

export const getCategories = async () => {
  const response = await client.get('/v1/categories')
  return response.data.data
}

export const createProduct = async (productData) => {
  const response = await client.post('/v1/products', productData)
  return response.data.data
}

export const updateProduct = async (id, productData) => {
  const response = await client.patch(`/v1/products/${id}`, productData)
  return response.data.data
}

export const deleteProduct = async (id) => {
  const response = await client.delete(`/v1/products/${id}`)
  return response.data
}

export const updateStock = async (stockData) => {
  const response = await client.patch('/v1/stock/adjust', stockData)
  return response.data.data
}

export const getStockLevels = async () => {
  const response = await client.get('/v1/stock/levels')
  return response.data.data
}
