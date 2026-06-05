import { useState, useMemo } from 'react'
import { getProducts, getCategories, createCategory, createProduct, updateProduct, deleteProduct, updateStock } from '../api/products'
import { Plus, Edit, Trash2, Package, Search, Filter, Info, FileText, Table } from 'lucide-react'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { useRemoteRefresh } from '../hooks/useRemoteRefresh'
import Skeleton from '../components/Skeleton'
import ErrorBanner from '../components/ErrorBanner'
import StatusPopup from '../components/StatusPopup'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { Button } from '../components/ui/Button'
import { db } from '../db/dexie'
import { formatCurrency } from '../utils/currency'

const defaultPackageOptions = [{ name: 'Unit', unitsPerBase: 1, price: '', wholesalePrice: '', isDefault: true, active: true }]

const getCachedProducts = async () => {
  const cachedProducts = await db.products.toArray()
  const cachedCategories = Array.from(
    new Map(
      cachedProducts
        .filter((product) => product.category)
        .map((product) => [product.category.id, product.category])
    ).values()
  )

  return { cachedProducts, cachedCategories }
}

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryData, setNewCategoryData] = useState({ name: '', hasPackaging: false })
  const [categoryError, setCategoryError] = useState('')
  const [categorySubmitting, setCategorySubmitting] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [statusMessage, setStatusMessage] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    categoryId: '',
    stock: 0,
    lowStockThreshold: 5,
    baseUnit: 'UNIT',
    cartonUnits: 24,
    cartonCount: 0,
    bottlePrice: '',
    cartonPrice: '',
    cartonWholesalePrice: '',
    packageOptions: defaultPackageOptions,
  })
  const [stockData, setStockData] = useState({ quantity: 1, type: 'RESTOCK', note: '' })

  const fetchData = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ])

      setProducts(productsData)
      setCategories(categoriesData)
      setError('')
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to load products and categories.'
      setError(message)
      const { cachedProducts, cachedCategories } = await getCachedProducts()
      if (cachedProducts.length > 0) {
        setProducts(cachedProducts)
        setCategories(cachedCategories)
      }
      console.error('Failed to fetch data', err)
    } finally {
      setLoading(false)
    }
  }

  useRemoteRefresh(() => fetchData({ silent: products.length > 0 }))

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.category?.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === 'All' || product.category?.name === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [products, searchTerm, selectedCategory])

  const handleOpenModal = (product = null) => {
    if (product) {
      const alcoholicOptions = (product.packageOptions || []).reduce(
        (acc, option) => {
          if (option.unitsPerBase === 1) acc.bottlePrice = option.price
          if (option.name?.toLowerCase().includes('carton')) {
            acc.cartonPrice = option.price
            acc.cartonWholesalePrice = option.wholesalePrice || ''
            acc.cartonUnits = option.unitsPerBase
          }
          return acc
        },
        { bottlePrice: '', cartonPrice: '', cartonWholesalePrice: '', cartonUnits: 24 }
      )
      const cartonCount = alcoholicOptions.cartonUnits
        ? Math.floor(product.stock / alcoholicOptions.cartonUnits)
        : 0

      setCurrentProduct(product)
      setFormData({
        name: product.name,
        price: product.price,
        categoryId: product.categoryId,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold ?? 5,
        baseUnit: product.baseUnit || 'UNIT',
        cartonUnits: alcoholicOptions.cartonUnits,
        cartonCount,
        bottlePrice: alcoholicOptions.bottlePrice || product.price || '',
        cartonPrice: alcoholicOptions.cartonPrice || '',
        cartonWholesalePrice: alcoholicOptions.cartonWholesalePrice || '',
        packageOptions: product.packageOptions?.length
          ? product.packageOptions.map((option) => ({ ...option, price: option.price, wholesalePrice: option.wholesalePrice || '' }))
          : [{ name: 'Unit', unitsPerBase: 1, price: product.price, wholesalePrice: '', isDefault: true, active: true }],
      })
    } else {
      setCurrentProduct(null)
      setFormData({
        name: '',
        price: '',
        categoryId: '',
        stock: 0,
        lowStockThreshold: 5,
        baseUnit: 'UNIT',
        cartonUnits: 24,
        cartonCount: 0,
        bottlePrice: '',
        cartonPrice: '',
        cartonWholesalePrice: '',
        packageOptions: defaultPackageOptions,
      })
    }
    setIsModalOpen(true)
  }

  const handleOpenStockModal = (product) => {
    setCurrentProduct(product)
    setStockData({ quantity: 1, type: 'RESTOCK', note: '' })
    setIsStockModalOpen(true)
  }

  const currentCategory = categories.find((category) => category.id === formData.categoryId)
  const isPackaged = currentCategory?.hasPackaging

  const calculatedStock = isPackaged && Number(formData.cartonCount) > 0
    ? Number(formData.cartonCount) * Number(formData.cartonUnits || 1)
    : Number(formData.stock)

  const handleCategorySubmit = async (e) => {
    e.preventDefault()
    if (!newCategoryData.name.trim()) return
    setCategorySubmitting(true)
    setCategoryError('')
    try {
      const createdCategory = await createCategory(newCategoryData)
      setCategories((prev) => [...prev, createdCategory])
      setFormData((prev) => ({ ...prev, categoryId: createdCategory.id }))
      setNewCategoryData({ name: '', hasPackaging: false })
      setIsCategoryModalOpen(false)
    } catch (err) {
      setCategoryError(err.response?.data?.message || 'Failed to create category')
    } finally {
      setCategorySubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const category = categories.find((categoryItem) => categoryItem.id === formData.categoryId)
      if (!category) {
        throw new Error('Select a category before saving the product')
      }
      const isPackagedCategory = category?.hasPackaging
      const defaultIndex = formData.packageOptions.findIndex((option) => option.isDefault)
      const packageOptions = isPackagedCategory
        ? [
            {
              name: 'Single Bottle',
              unitsPerBase: 1,
              price: Number(formData.bottlePrice) || Number(formData.price) || 0,
              isDefault: true,
              active: true,
            },
            {
              name: 'Carton',
              unitsPerBase: Number(formData.cartonUnits) || 1,
              price: Number(formData.cartonPrice) || 0,
              wholesalePrice: Number(formData.cartonWholesalePrice) || null,
              isDefault: false,
              active: true,
            },
          ]
        : formData.packageOptions.map((option, index) => ({
            name: option.name || 'Unit',
            unitsPerBase: Number(option.unitsPerBase) || 1,
            price: Number(option.price || formData.price) || 0,
            wholesalePrice: Number(option.wholesalePrice) || null,
            isDefault: index === (defaultIndex >= 0 ? defaultIndex : 0),
            active: option.active !== false,
          }))

      const payload = {
        name: formData.name,
        price: Number(isPackagedCategory ? formData.bottlePrice : formData.price) || 0,
        categoryId: formData.categoryId,
        baseUnit: formData.baseUnit,
        stock: calculatedStock,
        lowStockThreshold: Number(formData.lowStockThreshold) || 5,
        packageOptions,
      }

      if (currentProduct) {
        await updateProduct(currentProduct.id, payload)
      } else {
        await createProduct(payload)
      }
      setIsModalOpen(false)
      setStatusMessage({ type: 'success', text: currentProduct ? 'Product updated successfully.' : 'Product created successfully.' })
      fetchData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Product operation failed.' })
    }
  }

  const updatePackageOption = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      packageOptions: prev.packageOptions.map((option, optionIndex) => {
        if (field === 'isDefault') {
          return { ...option, isDefault: optionIndex === index }
        }
        return optionIndex === index ? { ...option, [field]: value } : option
      }),
    }))
  }

  const addPackageOption = () => {
    setFormData((prev) => ({
      ...prev,
      packageOptions: [...prev.packageOptions, { name: 'Box', unitsPerBase: 24, price: '', wholesalePrice: '', isDefault: false, active: true }],
    }))
  }

  const removePackageOption = (index) => {
    setFormData((prev) => ({
      ...prev,
      packageOptions: prev.packageOptions.filter((_, optionIndex) => optionIndex !== index),
    }))
  }

  const handleStockSubmit = async (e) => {
    e.preventDefault()
    try {
      await updateStock({
        productId: currentProduct.id,
        ...stockData,
      })
      setIsStockModalOpen(false)
      setStatusMessage({ type: 'success', text: 'Stock adjustment saved successfully.' })
      fetchData()
    } catch {
      setStatusMessage({ type: 'error', text: 'Stock update failed.' })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      setStatusMessage({ type: 'success', text: `${deleteTarget.name} deleted successfully.` })
      setDeleteTarget(null)
      fetchData()
    } catch {
      setStatusMessage({ type: 'error', text: 'Delete failed.' })
    } finally {
      setDeleting(false)
    }
  }

  const handleExportExcel = async () => {
    const headers = [
      { key: 'name', label: 'Product Name' },
      { key: 'categoryName', label: 'Category' },
      { key: 'price', label: 'Price (GHS)' },
      { key: 'stock', label: 'Current Stock' },
      { key: 'lowStockThreshold', label: 'Low Stock Threshold' },
      { key: 'baseUnit', label: 'Base Unit' }
    ]
    const data = filteredProducts.map(p => ({
      ...p,
      categoryName: p.category?.name || 'N/A'
    }))
    try {
      await exportToExcel(data, `Products_Export_${new Date().toISOString().split('T')[0]}`, headers)
      setStatusMessage({ type: 'success', text: 'Excel export completed.' })
    } catch {
      setStatusMessage({ type: 'error', text: 'Excel export failed.' })
    }
  }

  const handleExportPDF = async () => {
    const headers = [
      { key: 'name', label: 'Product Name' },
      { key: 'categoryName', label: 'Category' },
      { key: 'price', label: 'Price (GHS)', formatter: (val) => Number(val).toFixed(2) },
      { key: 'stock', label: 'Stock' },
      { key: 'lowStockThreshold', label: 'Low Stock Threshold' },
      { key: 'baseUnit', label: 'Unit' }
    ]
    const data = filteredProducts.map(p => ({
      ...p,
      categoryName: p.category?.name || 'N/A'
    }))
    try {
      await exportToPDF(data, `Products_Export_${new Date().toISOString().split('T')[0]}`, 'Product Inventory Report', headers)
      setStatusMessage({ type: 'success', text: 'PDF export completed.' })
    } catch {
      setStatusMessage({ type: 'error', text: 'PDF export failed.' })
    }
  }

  if (loading && products.length === 0) {
    return (
      <div className="min-h-full space-y-8 pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-48" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-14 w-32 rounded-2xl" />
            <Skeleton className="h-14 w-32 rounded-2xl" />
            <Skeleton className="h-14 w-44 rounded-2xl" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <Skeleton className="h-12 w-full max-w-md rounded-full" />
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-24 rounded-full" />)}
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full space-y-8 pb-10">
      <StatusPopup message={statusMessage} onClose={() => setStatusMessage(null)} />

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Inventory</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-bold text-text-secondary transition hover:bg-gray-50 active:scale-95"
          >
            <FileText size={18} /> Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-5 py-4 text-sm font-bold text-text-secondary transition hover:bg-gray-50 active:scale-95"
          >
            <Table size={18} /> Export Excel
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-blue px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark active:scale-95"
          >
            <Plus size={20} /> Add New Product
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onRetry={() => fetchData()} />

      {/* Search and Filters Card */}
      <div className="card p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-full border border-border bg-gray-50 py-3 pl-12 pr-4 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Filter size={16} className="text-text-muted mr-2 hidden sm:block" />
            {['All', ...categories.map((category) => category.name)].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-blue text-white shadow-md'
                    : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="bg-brand-blue-light/30 text-xs uppercase tracking-[0.15em] text-text-secondary">
                <th className="px-6 py-5 font-bold">Product Name</th>
                <th className="px-6 py-5 font-bold">Category</th>
                <th className="px-6 py-5 font-bold">Price (GHS)</th>
                <th className="px-6 py-5 font-bold">Packaging</th>
                <th className="px-6 py-5 font-bold">Current Stock</th>
                <th className="px-6 py-5 font-bold">Low Stock At</th>
                <th className="px-6 py-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {filteredProducts.map((product) => {
                const isPackagedProd = product.category?.hasPackaging
                const cartonOption = product.packageOptions?.find(o => o.name?.toLowerCase().includes('carton'))
                const unitsPerCarton = cartonOption?.unitsPerBase || 24
                const cartonCount = Math.floor(product.stock / unitsPerCarton)
                const remainingUnits = product.stock % unitsPerCarton
                const lowStockThreshold = Number(product.lowStockThreshold ?? 5)

                return (
                  <tr key={product.id} className="group hover:bg-brand-blue-light/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">{product.name}</span>
                        <span className="text-xs text-text-muted">{product.baseUnit || 'UNIT'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        isPackagedProd
                          ? 'border-purple-200 bg-purple-50 text-purple-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                        {product.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-text-primary">{formatCurrency(product.price)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {product.packageOptions?.length > 0 ? (
                          product.packageOptions.map((opt, idx) => (
                            <span key={idx} className="rounded-md border border-border bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                              {opt.name} ({opt.unitsPerBase})
                            </span>
                          ))
                        ) : (
                          <span className="text-text-muted text-xs">Unit</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`text-sm font-black ${product.stock <= lowStockThreshold ? 'text-danger' : 'text-brand-blue'}`}>
                          {product.stock} Units
                        </span>
                        {isPackagedProd && (
                          <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                            {cartonCount} Cartons {remainingUnits > 0 ? `+ ${remainingUnits} u` : ''}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-warning-light px-3 py-1 text-xs font-semibold text-warning">
                        {lowStockThreshold} units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenStockModal(product)} 
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-brand-blue transition hover:bg-brand-blue/10" 
                          title="Adjust Stock"
                          aria-label={`Adjust stock for ${product.name}`}
                        >
                          <Package size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(product)} 
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-gray-100"
                          title="Edit"
                          aria-label={`Edit ${product.name}`}
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => setDeleteTarget(product)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl text-danger transition hover:bg-danger/10" 
                          title="Delete"
                          aria-label={`Delete ${product.name}`}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredProducts.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <div className="rounded-full bg-gray-50 p-6">
              <Package size={48} className="text-gray-200" />
            </div>
            <p className="mt-4 font-semibold">No products found matching your filters.</p>
            <button 
              onClick={() => {setSearchTerm(''); setSelectedCategory('All')}}
              className="mt-2 text-sm font-bold text-brand-blue hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        eyebrow="Products"
        title={currentProduct ? 'Edit Product' : 'Add New Product'}
        size="lg"
      >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Club Beer"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-text-primary">Category</label>
                    <button
                      type="button"
                      onClick={() => setIsCategoryModalOpen(true)}
                      className="text-xs font-bold text-brand-blue hover:underline"
                    >
                      + Add New
                    </button>
                  </div>
                  {categories.length > 0 ? (
                    <select
                      required
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                    >
                      <option value="" disabled>Select a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-2xl border border-danger/20 bg-danger-light/10 p-3">
                      <span className="text-xs text-danger font-medium">No valid categories found.</span>
                      <button
                        type="button"
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="self-start text-xs font-bold text-brand-blue hover:underline"
                      >
                        + Create a Category
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary">Base Unit</label>
                  <select
                    value={formData.baseUnit}
                    onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                  >
                    <option value="UNIT">Unit</option>
                    <option value="BOTTLE">Bottle</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    placeholder="5"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {!isPackaged && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary">Default Price (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                    />
                  </div>
                )}
              </div>

              {isPackaged ? (
                <div className="space-y-6 rounded-[1.5rem] border border-brand-blue-light/50 bg-brand-blue-light/20 p-6">
                  <div className="flex items-center gap-2 text-brand-blue mb-2">
                    <Info size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">{currentCategory?.name} Configuration</span>
                  </div>
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Bottle Price (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.bottlePrice}
                        onChange={(e) => setFormData({ ...formData, bottlePrice: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Carton Price (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.cartonPrice}
                        onChange={(e) => setFormData({ ...formData, cartonPrice: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Units per Carton</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.cartonUnits}
                        onChange={(e) => setFormData({ ...formData, cartonUnits: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light shadow-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Wholesale Carton Price (GHS)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.cartonWholesalePrice}
                        onChange={(e) => setFormData({ ...formData, cartonWholesalePrice: e.target.value })}
                        placeholder="Optional"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Initial Cartons</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.cartonCount}
                        onChange={(e) => setFormData({ ...formData, cartonCount: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white/60 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-text-secondary">Computed Stock:</span>
                      <span className="text-lg font-black text-brand-blue">{calculatedStock} Units</span>
                    </div>
                    <p className="mt-1 text-[10px] text-text-muted italic">Stock is auto-calculated from carton quantity.</p>
                  </div>
                </div>
              ) : (
                !currentProduct && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary">Initial Stock (Units)</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                    />
                  </div>
                )
              )}

              {!isPackaged && (
                <div className="space-y-4 rounded-[1.5rem] border border-border bg-gray-50 p-6">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-text-primary uppercase tracking-wider">Package Options</label>
                    <button 
                      type="button" 
                      onClick={addPackageOption} 
                      className="rounded-xl border border-brand-blue/20 bg-brand-blue-light/30 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-brand-blue-light/50 transition-all"
                    >
                      + Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.packageOptions.map((option, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center rounded-xl border border-border bg-white p-3 shadow-sm">
                        <div className="col-span-3">
                          <input
                            value={option.name}
                            onChange={(e) => updatePackageOption(index, 'name', e.target.value)}
                            placeholder="e.g. Box"
                            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            value={option.unitsPerBase}
                            onChange={(e) => updatePackageOption(index, 'unitsPerBase', e.target.value)}
                            placeholder="Qty"
                            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.price}
                            onChange={(e) => updatePackageOption(index, 'price', e.target.value)}
                            placeholder="Price"
                            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.wholesalePrice || ''}
                            onChange={(e) => updatePackageOption(index, 'wholesalePrice', e.target.value)}
                            placeholder="Wholesale"
                            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="col-span-1 flex justify-center">
                          {formData.packageOptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePackageOption(index)}
                              className="text-danger hover:scale-110 transition-transform"
                              aria-label={`Remove package option ${option.name || index + 1}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-4 pt-6 border-t border-border">
                <Button
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  variant="secondary"
                  className="px-6 py-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit" 
                  className="px-8 py-4"
                >
                  {currentProduct ? 'Update Product' : 'Create Product'}
                </Button>
              </div>
            </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        eyebrow="Inventory"
        title="Adjust Stock"
        size="md"
      >
            <div className="mt-2 flex items-center gap-2 text-sm font-medium text-text-secondary">
              <Package size={16} className="text-brand-blue" />
              <span>{currentProduct?.name}</span>
            </div>

            <form onSubmit={handleStockSubmit} className="mt-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStockData({ ...stockData, type: 'RESTOCK' })}
                    className={`rounded-2xl py-4 text-sm font-bold transition-all ${
                      stockData.type === 'RESTOCK' 
                        ? 'bg-brand-blue text-white shadow-md' 
                        : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
                    }`}
                  >
                    Restock
                  </button>
                  <button
                    type="button"
                    onClick={() => setStockData({ ...stockData, type: 'ADJUSTMENT' })}
                    className={`rounded-2xl py-4 text-sm font-bold transition-all ${
                      stockData.type === 'ADJUSTMENT' 
                        ? 'bg-danger text-white shadow-md' 
                        : 'bg-white border border-border text-text-secondary hover:bg-gray-50'
                    }`}
                  >
                    Deduct
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary">Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockData.quantity}
                  onChange={(e) => setStockData({ ...stockData, quantity: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-4 text-sm font-bold text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-primary">Note / Reason</label>
                <textarea
                  value={stockData.note}
                  onChange={(e) => setStockData({ ...stockData, note: e.target.value })}
                  rows="3"
                  placeholder="e.g. Damaged stock, Year-end count..."
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <Button
                  type="button" 
                  onClick={() => setIsStockModalOpen(false)} 
                  variant="secondary"
                  className="px-6 py-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit" 
                  className="px-8 py-4"
                >
                  Confirm Adjustment
                </Button>
              </div>
            </form>
      </Modal>

      <Modal
        open={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        eyebrow="Products"
        title="Add Category"
        size="sm"
        closeDisabled={categorySubmitting}
      >
        <form onSubmit={handleCategorySubmit} className="space-y-4">
          {categoryError && (
            <div className="rounded-2xl border border-danger/20 bg-danger-light/30 p-3 text-sm font-semibold text-danger">
              {categoryError}
            </div>
          )}
          <div>
            <label className="mb-2 block text-sm font-semibold text-text-primary">Category name</label>
            <input
              value={newCategoryData.name}
              onChange={(event) => setNewCategoryData({ ...newCategoryData, name: event.target.value })}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              placeholder="Alcoholic"
              required
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary">
            <input
              type="checkbox"
              checked={newCategoryData.hasPackaging}
              onChange={(event) => setNewCategoryData({ ...newCategoryData, hasPackaging: event.target.checked })}
              className="h-4 w-4 accent-brand-blue"
            />
            Has bottle/carton packaging
          </label>
          <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
            <Button type="button" variant="secondary" onClick={() => setIsCategoryModalOpen(false)} disabled={categorySubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={categorySubmitting}>
              Add Category
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Product?"
        message={deleteTarget ? `Delete ${deleteTarget.name}? This product will no longer be available for sales.` : ''}
        confirmLabel="Delete Product"
        tone="danger"
        loading={deleting}
      />
    </div>
  )
}
