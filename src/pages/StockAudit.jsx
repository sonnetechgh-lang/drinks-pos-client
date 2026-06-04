/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { getStockLevels, updateStockAudit } from '../api/products'
import { CheckCircle, Package, Search } from 'lucide-react'
import Skeleton from '../components/Skeleton'
import ErrorBanner from '../components/ErrorBanner'
import { db } from '../db/dexie'

export default function StockAudit() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [auditData, setAuditData] = useState({}) // { productId: actualQuantity }
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState('')

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getStockLevels()
      setProducts(data)
      setError('')
    } catch (error) {
      setError(error.response?.data?.message || error.message || 'Failed to load stock levels.')
      const cachedProducts = await db.products.toArray()
      if (cachedProducts.length > 0) setProducts(cachedProducts)
      console.error('Failed to fetch products', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleInputChange = (productId, value) => {
    setAuditData(prev => ({
      ...prev,
      [productId]: value
    }))
  }

  const handleSubmitAudit = async (product) => {
    const actualQuantity = auditData[product.id]
    if (actualQuantity === undefined || actualQuantity === '') return

    setSubmitting(true)
    try {
      await updateStockAudit({
        productId: product.id,
        actualQuantity: parseInt(actualQuantity, 10),
        note: `Physical audit: ${actualQuantity} units found`
      })
      
      setMessage({ type: 'success', text: `Successfully updated ${product.name}` })
      setAuditData(prev => {
        const next = { ...prev }
        delete next[product.id]
        return next
      })
      fetchProducts()
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      console.error('Audit failed', error)
      setMessage({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to update stock. Please try again.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading && products.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Inventory Control</p>
        <h1 className="mt-3 text-3xl font-black text-text-primary">Physical Stock Audit</h1>
      </div>

      <ErrorBanner message={error} onRetry={fetchProducts} />

      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full rounded-2xl border border-border bg-white pl-12 pr-4 py-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {message && (
            <div className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold ${
              message.type === 'success'
                ? 'bg-success-light text-success'
                : 'bg-danger-light text-danger'
            }`}>
              <CheckCircle size={16} /> {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map(product => {
          const currentInput = auditData[product.id]
          const isDirty = currentInput !== undefined && currentInput !== ''
          const difference = isDirty ? parseInt(currentInput) - product.stock : 0

          return (
            <div key={product.id} className="card p-6 flex flex-col justify-between group hover:border-brand-blue transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-text-primary">{product.name}</h3>
                  <p className="text-xs text-text-muted uppercase tracking-wider">{product.category?.name}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-text-muted group-hover:bg-brand-blue/10 group-hover:text-brand-blue transition-colors">
                  <Package size={20} />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-y border-gray-50 py-4">
                <div className="text-center flex-1">
                  <p className="text-[10px] font-bold text-text-muted uppercase">System</p>
                  <p className="mt-1 text-lg font-black text-text-primary">{product.stock}</p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div className="text-center flex-1">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Actual</p>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 w-20 text-center rounded-xl border border-border bg-gray-50 py-1 text-lg font-black text-brand-blue focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light outline-none"
                    value={currentInput ?? ''}
                    onChange={(e) => handleInputChange(product.id, e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className={`text-xs font-bold ${difference === 0 ? 'text-text-muted' : difference > 0 ? 'text-success' : 'text-danger'}`}>
                  {isDirty ? (
                    <span className="flex items-center gap-1">
                      {difference === 0 ? 'Matches' : `${difference > 0 ? '+' : ''}${difference} difference`}
                    </span>
                  ) : (
                    'Enter physical count'
                  )}
                </div>
                
                <button
                  disabled={!isDirty || submitting}
                  onClick={() => handleSubmitAudit(product)}
                  className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-blue-dark disabled:opacity-30 transition-all active:scale-95"
                >
                  Confirm
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
