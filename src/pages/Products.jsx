import { useState, useEffect, useMemo } from 'react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, updateStock } from '../api/products'
import { Plus, Edit, Trash2, Package, Search, Filter, Info, FileText, Table } from 'lucide-react'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'

const defaultPackageOptions = [{ name: 'Unit', unitsPerBase: 1, price: '', isDefault: true, active: true }]

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  
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
    packageOptions: defaultPackageOptions,
  })
  const [stockData, setStockData] = useState({ quantity: 1, type: 'RESTOCK', note: '' })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ])

      setProducts(productsData)
      setCategories(categoriesData)
    } catch (_err) {
      console.error('Failed to fetch data', _err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

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
            acc.cartonUnits = option.unitsPerBase
          }
          return acc
        },
        { bottlePrice: '', cartonPrice: '', cartonUnits: 24 }
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
        packageOptions: product.packageOptions?.length
          ? product.packageOptions.map((option) => ({ ...option, price: option.price }))
          : [{ name: 'Unit', unitsPerBase: 1, price: product.price, isDefault: true, active: true }],
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
  const isAlcoholic = currentCategory?.name === 'Alcoholic'

  const calculatedStock = isAlcoholic && Number(formData.cartonCount) > 0
    ? Number(formData.cartonCount) * Number(formData.cartonUnits || 1)
    : Number(formData.stock)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const category = categories.find((categoryItem) => categoryItem.id === formData.categoryId)
      const isAlcoholicCategory = category?.name === 'Alcoholic'
      const defaultIndex = formData.packageOptions.findIndex((option) => option.isDefault)
      const packageOptions = isAlcoholicCategory
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
              isDefault: false,
              active: true,
            },
          ]
        : formData.packageOptions.map((option, index) => ({
            name: option.name || 'Unit',
            unitsPerBase: Number(option.unitsPerBase) || 1,
            price: Number(option.price || formData.price) || 0,
            isDefault: index === (defaultIndex >= 0 ? defaultIndex : 0),
            active: option.active !== false,
          }))

      const payload = {
        name: formData.name,
        price: Number(isAlcoholicCategory ? formData.bottlePrice : formData.price) || 0,
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
      fetchData()
    } catch (_err) {
      alert('Operation failed')
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
      packageOptions: [...prev.packageOptions, { name: 'Box', unitsPerBase: 24, price: '', isDefault: false, active: true }],
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
      fetchData()
    } catch (_err) {
      alert('Stock update failed')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id)
        fetchData()
      } catch (_err) {
        alert('Delete failed')
      }
    }
  }

  const handleExportExcel = async () => {
    const headers = [
      { key: 'name', label: 'Product Name' },
      { key: 'categoryName', label: 'Category' },
      { key: 'price', label: 'Price (GH₵)' },
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
    } catch (_err) {
      alert('Excel export failed')
    }
  }

  const handleExportPDF = async () => {
    const headers = [
      { key: 'name', label: 'Product Name' },
      { key: 'categoryName', label: 'Category' },
      { key: 'price', label: 'Price (GH₵)', formatter: (val) => Number(val).toFixed(2) },
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
    } catch (_err) {
      alert('PDF export failed')
    }
  }

  if (loading && products.length === 0) return <div className="p-8 text-center text-text-secondary">Loading...</div>

  return (
    <div className="min-h-full space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Inventory</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-border px-5 py-4 text-sm font-bold text-text-secondary transition hover:bg-gray-50 active:scale-95"
          >
            <FileText size={18} /> Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-border px-5 py-4 text-sm font-bold text-text-secondary transition hover:bg-gray-50 active:scale-95"
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
                <th className="px-6 py-5 font-bold">Price (GH₵)</th>
                <th className="px-6 py-5 font-bold">Packaging</th>
                <th className="px-6 py-5 font-bold">Current Stock</th>
                <th className="px-6 py-5 font-bold">Low Stock At</th>
                <th className="px-6 py-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {filteredProducts.map((product) => {
                const isAlcoholicProd = product.category?.name === 'Alcoholic'
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
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isAlcoholicProd ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {product.category?.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-black text-text-primary">₵ {Number(product.price).toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {product.packageOptions?.length > 0 ? (
                          product.packageOptions.map((opt, idx) => (
                            <span key={idx} className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-secondary">
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
                        {isAlcoholicProd && (
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
                          onClick={() => handleDelete(product.id)} 
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-text-primary">{currentProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 hover:bg-gray-100 transition-colors">
                <Trash2 size={20} className="text-text-muted rotate-45" />
              </button>
            </div>
            
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
                  <label className="text-sm font-bold text-text-primary">Category</label>
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
                    <div className="rounded-2xl border border-danger/20 bg-danger-light/10 p-3 text-xs text-danger font-medium">
                      No valid categories found (Alcoholic/Non-Alcoholic). Please seed the database or contact admin.
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
                    <option value="CAN">Can</option>
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
                {!isAlcoholic && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary">Default Price (GH₵)</label>
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

              {isAlcoholic ? (
                <div className="space-y-6 rounded-[1.5rem] bg-brand-blue-light/20 p-6 border border-brand-blue-light/50">
                  <div className="flex items-center gap-2 text-brand-blue mb-2">
                    <Info size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Alcoholic Product Configuration</span>
                  </div>
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary">Bottle Price (GH₵)</label>
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
                      <label className="text-sm font-bold text-text-primary">Carton Price (GH₵)</label>
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

                  <div className="rounded-2xl bg-white/60 p-4 border border-white/50">
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

              {!isAlcoholic && (
                <div className="space-y-4 rounded-[1.5rem] bg-gray-50 p-6 border border-border">
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
                      <div key={index} className="grid grid-cols-12 gap-2 items-center rounded-xl bg-white p-3 border border-border shadow-sm">
                        <div className="col-span-4">
                          <input
                            value={option.name}
                            onChange={(e) => updatePackageOption(index, 'name', e.target.value)}
                            placeholder="e.g. Box"
                            className="w-full rounded-lg border border-border px-3 py-2 text-xs outline-none focus:border-brand-blue"
                          />
                        </div>
                        <div className="col-span-3">
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
                        <div className="col-span-2 flex justify-center">
                          {formData.packageOptions.length > 1 && (
                            <button type="button" onClick={() => removePackageOption(index)} className="text-danger hover:scale-110 transition-transform">
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
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="rounded-2xl px-6 py-4 text-sm font-bold text-text-secondary hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="rounded-2xl bg-brand-blue px-8 py-4 text-sm font-black text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-95 transition-all"
                >
                  {currentProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-text-primary">Adjust Stock</h2>
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
                <button 
                  type="button" 
                  onClick={() => setIsStockModalOpen(false)} 
                  className="rounded-2xl px-6 py-4 text-sm font-bold text-text-secondary hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="rounded-2xl bg-brand-blue px-8 py-4 text-sm font-black text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark active:scale-95 transition-all"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
