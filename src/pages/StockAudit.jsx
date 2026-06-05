/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { getStockLevels, updateStockAudit } from '../api/products'
import { Package, Search } from 'lucide-react'
import Skeleton from '../components/Skeleton'
import ErrorBanner from '../components/ErrorBanner'
import StatusPopup from '../components/StatusPopup'
import { db } from '../db/dexie'

export default function StockAudit() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [auditData, setAuditData] = useState({}) // { productId: actualQuantity }
  const [submittingProductId, setSubmittingProductId] = useState(null)
  const [showChangedOnly, setShowChangedOnly] = useState(false)
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

    setSubmittingProductId(product.id)
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
      setSubmittingProductId(null)
    }
  }

  const filteredProducts = products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((product) => {
      if (!showChangedOnly) return true
      const currentInput = auditData[product.id]
      return currentInput !== undefined && currentInput !== '' && Number(currentInput) !== Number(product.stock)
    })
  const pendingAudits = Object.values(auditData).filter((value) => value !== undefined && value !== '').length

  if (loading && products.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <StatusPopup message={message} onClose={() => setMessage(null)} />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Inventory Control</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Physical Stock Audit</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs font-bold uppercase text-text-secondary">Products</p>
            <p className="mt-1 text-xl font-black text-text-primary">{filteredProducts.length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-xs font-bold uppercase text-text-secondary">Pending</p>
            <p className="mt-1 text-xl font-black text-brand-blue">{pendingAudits}</p>
          </div>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={fetchProducts} />

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              placeholder="Search products..."
              className="w-full rounded-2xl border border-border bg-white pl-12 pr-4 py-3 text-sm outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowChangedOnly((value) => !value)}
            className={`rounded-2xl border px-4 py-3 text-sm font-bold transition ${showChangedOnly ? 'border-brand-blue bg-brand-blue-light text-brand-blue' : 'border-border bg-white text-text-secondary hover:border-brand-blue hover:text-brand-blue'}`}
          >
            {showChangedOnly ? 'Showing changed' : 'Show changed only'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map(product => {
          const currentInput = auditData[product.id]
          const isDirty = currentInput !== undefined && currentInput !== ''
          const difference = isDirty ? parseInt(currentInput) - product.stock : 0

          return (
            <div key={product.id} className={`flex min-h-[230px] flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm transition-colors hover:border-brand-blue ${isDirty ? difference === 0 ? 'border-success/40' : 'border-warning/50' : 'border-border'}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-text-primary">{product.name}</h3>
                  <p className="mt-1 truncate text-xs font-semibold uppercase text-text-muted">{product.category?.name || 'Uncategorized'}</p>
                </div>
                <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-text-muted transition-colors">
                  <Package size={20} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl border border-transparent bg-slate-50 px-3 py-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">System</p>
                  <p className="mt-1 text-lg font-black text-text-primary">{product.stock}</p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-[10px] font-bold text-text-muted uppercase">Actual</p>
                  <input
                    type="number"
                    min="0"
                    className="mt-1 h-10 w-24 rounded-xl border border-border bg-white text-center text-lg font-black text-brand-blue outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    value={currentInput ?? ''}
                    onChange={(e) => handleInputChange(product.id, e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
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
                  disabled={!isDirty || submittingProductId === product.id}
                  onClick={() => handleSubmitAudit(product)}
                  className="h-10 rounded-xl bg-brand-blue px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-brand-blue-dark disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {submittingProductId === product.id ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {filteredProducts.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-white p-10 text-center text-text-secondary">
          No products match the current audit filters.
        </div>
      )}
    </div>
  )
}
