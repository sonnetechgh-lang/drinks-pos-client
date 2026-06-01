import { useState, useEffect } from 'react'
import { getProducts, getCategories, createProduct, updateProduct, deleteProduct, updateStock } from '../api/products'
import { Plus, Edit, Trash2, Package } from 'lucide-react'

const defaultPackageOptions = [{ name: 'Unit', unitsPerBase: 1, price: '', isDefault: true, active: true }]
const allowedCategoryNames = ['Alcoholic', 'Non-Alcoholic']

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [currentProduct, setCurrentProduct] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    categoryId: '',
    stock: 0,
    baseUnit: 'UNIT',
    cartonUnits: 24,
    cartonCount: 0,
    bottlePrice: '',
    cartonPrice: '',
    packageOptions: defaultPackageOptions,
  })
  const [stockData, setStockData] = useState({ quantity: 1, type: 'RESTOCK', note: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [productsData, categoriesData] = await Promise.all([
        getProducts(),
        getCategories(),
      ])

      const allowedCategories = categoriesData.filter((category) => allowedCategoryNames.includes(category.name))
      const orderedCategories = ['Alcoholic', 'Non-Alcoholic']
        .map((name) => allowedCategories.find((category) => category.name === name))
        .filter(Boolean)

      setProducts(productsData)
      setCategories(orderedCategories.length ? orderedCategories : categoriesData)
    } catch (error) {
      console.error('Failed to fetch data', error)
    } finally {
      setLoading(false)
    }
  }

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
        categoryId: categories[0]?.id || '',
        stock: 0,
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
        packageOptions,
      }

      if (currentProduct) {
        await updateProduct(currentProduct.id, payload)
      } else {
        await createProduct(payload)
      }
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
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
    } catch (error) {
      alert('Stock update failed')
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id)
        fetchData()
      } catch (error) {
        alert('Delete failed')
      }
    }
  }

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading...</div>

  return (
    <div className="min-h-full space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Inventory</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Products</h1>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-brand-blue/20 transition hover:bg-brand-blue-dark"
        >
          <Plus size={18} /> Add Product
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="bg-brand-blue-light/40 text-xs uppercase tracking-[0.18em] text-text-secondary">
              <tr>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Packages</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-t border-border">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-text-primary">{product.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{product.category?.name}</td>
                  <td className="px-6 py-4 text-text-secondary">{product.category?.name}</td>
                  <td className="px-6 py-4 font-semibold text-text-primary">₵ {product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-text-secondary">
                    {product.packageOptions?.length
                      ? product.packageOptions.map((option) => `${option.name} (${option.unitsPerBase})`).join(', ')
                      : 'Unit'}
                  </td>
                  <td className={`px-6 py-4 font-semibold ${product.stock <= 5 ? 'text-danger' : 'text-brand-blue'}`}>
                    {product.stock}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <button onClick={() => handleOpenStockModal(product)} className="text-brand-blue hover:text-brand-blue-dark" title="Adjust Stock">
                        <Package size={18} />
                      </button>
                      <button onClick={() => handleOpenModal(product)} className="text-text-secondary hover:text-text-primary" title="Edit">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-700" title="Delete">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-text-primary">{currentProduct ? 'Edit Product' : 'Add Product'}</h2>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Category</label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Base Unit</label>
                <select
                  value={formData.baseUnit}
                  onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                >
                  <option value="UNIT">Unit</option>
                  <option value="BOTTLE">Bottle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Price (GH₵)</label>
                <input
                  type="number"
                  step="0.01"
                  required={!isAlcoholic}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
                {isAlcoholic && (
                  <p className="mt-2 text-xs text-text-secondary">For alcoholic products, this value is only used when no bottle price is specified.</p>
                )}
              </div>
              {isAlcoholic ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Bottle Price (GH₵)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.bottlePrice}
                        onChange={(e) => setFormData({ ...formData, bottlePrice: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Carton Price (GH₵)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.cartonPrice}
                        onChange={(e) => setFormData({ ...formData, cartonPrice: e.target.value })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Units per Carton</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.cartonUnits}
                        onChange={(e) => setFormData({ ...formData, cartonUnits: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-2">Initial Cartons</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={formData.cartonCount}
                        onChange={(e) => setFormData({ ...formData, cartonCount: Number(e.target.value) })}
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-text-primary mb-2">Stock (units)</label>
                    <input
                      type="number"
                      readOnly
                      value={calculatedStock}
                      className="w-full rounded-2xl border border-border bg-gray-100 px-4 py-3 text-sm text-text-secondary outline-none"
                    />
                    <p className="mt-2 text-xs text-text-secondary">Alcoholic product stock is auto-calculated from carton quantity.</p>
                  </div>
                </>
              ) : (
                !currentProduct && (
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-2">Initial Stock</label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    />
                  </div>
                )
              )}
              {!isAlcoholic && (
                <div className="rounded-2xl border border-border bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-text-primary">Package Options</label>
                    <button type="button" onClick={addPackageOption} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary hover:bg-gray-50">
                      Add Option
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {formData.packageOptions.map((option, index) => (
                      <div key={index} className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3">
                        <input
                          value={option.name}
                          onChange={(e) => updatePackageOption(index, 'name', e.target.value)}
                          placeholder="Bottle"
                          className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
                        />
                        <input
                          type="number"
                          min="1"
                          value={option.unitsPerBase}
                          onChange={(e) => updatePackageOption(index, 'unitsPerBase', e.target.value)}
                          placeholder="Units"
                          className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={option.price}
                          onChange={(e) => updatePackageOption(index, 'price', e.target.value)}
                          placeholder="Price"
                          className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-brand-blue"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary">
                            <input
                              type="radio"
                              checked={option.isDefault}
                              onChange={() => updatePackageOption(index, 'isDefault', true)}
                            />
                            Default
                          </label>
                          {formData.packageOptions.length > 1 && (
                            <button type="button" onClick={() => removePackageOption(index)} className="text-xs font-semibold text-danger">
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white hover:bg-brand-blue-dark">
                  {currentProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-text-primary">Adjust Stock</h2>
            <p className="mt-2 text-sm text-text-secondary">{currentProduct?.name}</p>
            <form onSubmit={handleStockSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Adjustment Type</label>
                <select
                  value={stockData.type}
                  onChange={(e) => setStockData({ ...stockData, type: e.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                >
                  <option value="RESTOCK">Restock</option>
                  <option value="ADJUSTMENT">Deduct</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={stockData.quantity}
                  onChange={(e) => setStockData({ ...stockData, quantity: Number(e.target.value) })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Note</label>
                <textarea
                  value={stockData.note}
                  onChange={(e) => setStockData({ ...stockData, note: e.target.value })}
                  rows="3"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white hover:bg-brand-blue-dark">
                  Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
