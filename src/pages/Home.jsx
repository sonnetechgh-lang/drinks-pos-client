import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { addCustomerToQueue, addToQueue } from '../db/syncQueue'
import { getProducts } from '../api/products'
import { createCustomer, getCustomers } from '../api/customers'
import { useAuth } from '../hooks/useAuth'
import { generateReceipt } from '../utils/receiptGenerator'
import { ShoppingCart, Search, Trash2, Plus, Minus, Package, Printer, Wifi, WifiOff } from 'lucide-react'

const brandTabs = ['All', 'Coca-Cola', 'Pepsi', 'Malta', 'Minerals', 'Malt', 'Water', 'Energy', 'Other']

export default function Home() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [cart, setCart] = useState([])
  const [lastSale, setLastSale] = useState(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [paymentAmounts, setPaymentAmounts] = useState({ cash: '', momo: '', advance: '', credit: '' })
  const [momoReference, setMomoReference] = useState('')

  const products = useLiveQuery(() => db.products.toArray()) || []
  const customers = useLiveQuery(() => db.customers.where('active').notEqual(0).toArray()) || []

  useEffect(() => {
    const syncProducts = async () => {
      try {
        await getProducts()
      } catch (err) {
        console.warn('Could not sync products from server, using local cache.')
      }
    }
    syncProducts()

    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await getCustomers()
        await db.customers.bulkPut(data.map((customer) => ({ ...customer, synced: 1 })))
      } catch (err) {
        console.warn('Unable to load customers', err)
      }
    }
    loadCustomers()
  }, [])

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) || product.category?.name?.toLowerCase().includes(search.toLowerCase()))
      .filter((product) => activeCategory === 'All' || product.category?.name === activeCategory)
  }, [products, search, activeCategory])

  const addToCart = (product) => {
    if (product.stock <= 0) return
    setCart((prev) => {
      const defaultPackage = product.packageOptions?.find((option) => option.isDefault && option.active !== false)
        || product.packageOptions?.find((option) => option.active !== false)
        || null
      const cartProduct = {
        ...product,
        packageOptionId: defaultPackage?.id,
        packageName: defaultPackage?.name || 'Unit',
        unitsPerBase: defaultPackage?.unitsPerBase || 1,
        price: defaultPackage?.price ?? product.price,
        baseQuantity: defaultPackage?.unitsPerBase || 1,
      }
      const existing = prev.find((item) => item.id === product.id && item.packageOptionId === cartProduct.packageOptionId)
      if (existing) {
        return prev.map((item) => (item.id === product.id && item.packageOptionId === cartProduct.packageOptionId ? { ...item, quantity: item.quantity + 1, baseQuantity: (item.quantity + 1) * item.unitsPerBase } : item))
      }
      return [...prev, { ...cartProduct, quantity: 1 }]
    })
  }

  const updateQuantity = (id, packageOptionId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id && item.packageOptionId === packageOptionId) {
          const newQty = Math.max(1, item.quantity + delta)
          return { ...item, quantity: newQty, baseQuantity: newQty * item.unitsPerBase }
        }
        return item
      })
    )
  }

  const updatePackageOption = (id, currentPackageOptionId, nextPackageOptionId) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id || item.packageOptionId !== currentPackageOptionId) return item
      const option = item.packageOptions?.find((packageOption) => packageOption.id === nextPackageOptionId)
      if (!option) return item
      return {
        ...item,
        packageOptionId: option.id,
        packageName: option.name,
        unitsPerBase: option.unitsPerBase,
        price: option.price,
        baseQuantity: item.quantity * option.unitsPerBase,
      }
    }))
  }

  const removeFromCart = (id, packageOptionId) => {
    setCart((prev) => prev.filter((item) => !(item.id === id && item.packageOptionId === packageOptionId)))
  }

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  }, [cart])

  const parseAmount = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  const setPaymentAmount = (key, value) => {
    setPaymentAmounts((prev) => ({ ...prev, [key]: value }))
  }

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return

    const payload = { name: newCustomerName.trim(), phone: newCustomerPhone.trim() || undefined }
    try {
      const customer = online ? await createCustomer(payload) : await addCustomerToQueue(payload)
      await db.customers.put({ ...customer, synced: online ? 1 : 0 })
      setSelectedCustomerId(customer.id)
      setCustomerName('')
      setNewCustomerName('')
      setNewCustomerPhone('')
      setShowNewCustomer(false)
    } catch (err) {
      alert('Failed to create customer')
    }
  }

  const handleCheckout = async () => {
    if (cart.length === 0) return

    const cashAmount = parseAmount(paymentAmounts.cash)
    const momoAmount = parseAmount(paymentAmounts.momo)
    const advanceAmount = parseAmount(paymentAmounts.advance)
    const explicitCreditAmount = parseAmount(paymentAmounts.credit)
    const hasManualPayments = cashAmount > 0 || momoAmount > 0 || advanceAmount > 0 || explicitCreditAmount > 0
    const defaultCashAmount = hasManualPayments ? cashAmount : cartTotal
    const nonCreditAmount = defaultCashAmount + momoAmount + advanceAmount
    const computedCreditAmount = Math.max(0, cartTotal - nonCreditAmount)
    const finalCreditAmount = Math.max(explicitCreditAmount, computedCreditAmount)

    if (nonCreditAmount > cartTotal) {
      alert('Cash, MoMo, and advance payments cannot exceed the sale total.')
      return
    }

    if ((advanceAmount > 0 || finalCreditAmount > 0) && !selectedCustomerId) {
      alert('Please select or add a saved customer for credit or advance balance sales.')
      return
    }

    if (momoAmount > 0 && !momoReference.trim()) {
      alert('Please enter a MoMo reference for mobile payments.')
      return
    }

    const paymentLines = []
    if (defaultCashAmount > 0) paymentLines.push({ method: 'CASH', amount: defaultCashAmount })
    if (momoAmount > 0) paymentLines.push({ method: 'MOMO', amount: momoAmount, momoReference: momoReference.trim() })
    if (advanceAmount > 0) paymentLines.push({ method: 'ADVANCE_BALANCE', amount: advanceAmount })
    if (finalCreditAmount > 0) paymentLines.push({ method: 'CREDIT', amount: finalCreditAmount })

    const paidAmount = defaultCashAmount + momoAmount + advanceAmount
    const paymentStatus = finalCreditAmount <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'CREDIT'
    const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId)

    const sale = {
      clientId: crypto.randomUUID(),
      total: cartTotal,
      amountPaid: paidAmount,
      creditAmount: finalCreditAmount,
      paymentStatus,
      customerId: selectedCustomer?.synced === 0 ? undefined : selectedCustomerId || undefined,
      customerClientId: selectedCustomer?.synced === 0 ? selectedCustomer.clientId : undefined,
      customerName: selectedCustomerId ? undefined : customerName.trim() || undefined,
      cashierId: user.id,
      createdAt: new Date().toISOString(),
      items: cart.map((item) => ({
        productId: item.id,
        packageOptionId: item.packageOptionId || undefined,
        packageName: item.packageName || item.category?.name || item.name,
        unitsPerBase: item.unitsPerBase || 1,
        quantity: item.quantity,
        baseQuantity: item.baseQuantity || item.quantity,
        unitPrice: item.price,
      })),
      paymentLines,
    }

    try {
      await addToQueue(sale)
      setLastSale(sale)
      setCart([])
      setCustomerName('')
      setSelectedCustomerId('')
      setMomoReference('')
      setPaymentAmounts({ cash: '', momo: '', advance: '', credit: '' })
    } catch (err) {
      alert('Failed to save transaction locally')
    }
  }

  const handlePrint = () => {
    if (lastSale) {
      generateReceipt(lastSale)
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-28 xl:pb-0">
      <div className={`rounded-3xl border border-border px-4 py-3 text-sm font-semibold mb-6 ${online ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
        <div className="flex items-center justify-center gap-2">
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online
            ? 'Online — transactions sync immediately.'
            : 'Offline — transactions save locally and sync when online.'}
        </div>
      </div>

      <main className="flex-1 flex flex-col xl:flex-row overflow-visible gap-6">
        <section className="flex-1 flex flex-col overflow-visible">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Cashier</p>
              <p className="mt-4 text-xl font-black text-text-primary">{user?.name}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Products</p>
              <p className="mt-4 text-xl font-black text-text-primary">{products.length}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Current Sale</p>
              <p className="mt-4 text-xl font-black text-text-primary">{cart.length} items</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border bg-brand-blue-light/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-text-primary">Product Catalog</h2>
                <p className="mt-1 text-sm text-text-secondary">Tap a product to add it to the cart.</p>
              </div>
              <div className="relative w-full max-w-md">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products or brand"
                  className="w-full rounded-full border border-border bg-white py-3 pl-12 pr-4 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-6">
              {brandTabs.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === category ? 'bg-brand-blue text-white shadow-sm' : 'bg-white border border-border text-text-secondary hover:bg-gray-50'}`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => {
                  const selected = cart.some((item) => item.id === product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                      className={`group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-3xl border ${selected ? 'border-brand-blue' : 'border-border'} bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-float ${product.stock <= 0 ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <div className="flex h-20 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
                        <Package size={34} />
                      </div>
                      <div className="mt-4">
                        <h3 className="text-base font-semibold text-text-primary truncate">{product.name}</h3>
                        <p className="mt-2 text-sm text-text-secondary">{product.category?.name || 'Variant'}</p>
                        <p className="mt-3 text-lg font-black text-brand-blue">₵ {product.price.toFixed(2)}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm font-semibold">
                        <span className={`rounded-full px-3 py-1 ${product.stock <= 5 ? 'bg-danger-light text-danger' : 'bg-brand-blue-light text-brand-blue'}`}>
                          {product.stock <= 0 ? 'Out of Stock' : `${product.stock} units`}
                        </span>
                        <span className="text-text-secondary">Tap to add</span>
                      </div>
                      {product.stock <= 0 && (
                        <div className="absolute inset-0 rounded-3xl bg-slate-900/55 flex items-center justify-center text-sm font-semibold text-white">
                          Out of Stock
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="mt-10 flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-gray-50 p-10 text-center text-text-secondary">
                  <Package size={64} className="text-gray-300" />
                  <p className="mt-4 text-base font-semibold">No products match your search.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="w-full xl:sticky xl:top-20 xl:w-96 xl:self-start flex-shrink-0">
          <div className="card flex h-full flex-col p-6 xl:max-h-[calc(100vh-6rem)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Current Sale</p>
                <h2 className="mt-3 text-2xl font-black text-text-primary">Cart</h2>
                <p className="mt-2 text-sm text-text-secondary">Transaction ID: <span className="font-semibold text-text-primary">{cart.length ? `TX-${String(cart[0].id).slice(0, 6).toUpperCase()}` : 'NEW-SALE'}</span></p>
              </div>
              <ShoppingCart size={24} className="text-brand-blue" />
            </div>

            <div className="mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
              {cart.length > 0 ? (
                cart.map((item) => (
                  <div key={`${item.id}-${item.packageOptionId || 'unit'}`} className="rounded-3xl border border-border bg-success-light/30 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary truncate">{item.name}</p>
                        <p className="mt-1 text-sm text-text-secondary">₵ {item.price.toFixed(2)} each</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.packageOptionId)} className="text-text-secondary hover:text-danger transition">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {item.packageOptions?.length > 1 && (
                      <select
                        value={item.packageOptionId || ''}
                        onChange={(e) => updatePackageOption(item.id, item.packageOptionId, e.target.value)}
                        className="mt-3 w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      >
                        {item.packageOptions.filter((option) => option.active !== false).map((option) => (
                          <option key={option.id} value={option.id}>{option.name} - GH {Number(option.price).toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-full border border-border bg-white px-2">
                        <button onClick={() => updateQuantity(item.id, item.packageOptionId, -1)} className="p-2 text-text-secondary hover:text-text-primary transition"><Minus size={14} /></button>
                        <span className="mx-3 text-sm font-black">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.packageOptionId, 1)} className="p-2 text-text-secondary hover:text-text-primary transition"><Plus size={14} /></button>
                      </div>
                      <p className="text-sm font-black text-text-primary">₵ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    {item.unitsPerBase > 1 && (
                      <p className="mt-2 text-xs font-semibold text-text-secondary">{item.baseQuantity} bottles deducted</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-border bg-gray-50 p-8 text-center text-text-secondary">
                  <p className="text-base font-semibold">Your cart is empty.</p>
                  <p className="mt-2 text-sm">Add products to start a transaction.</p>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-border bg-white p-5">
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Subtotal</span>
                <span className="font-semibold text-text-primary">₵ {cartTotal.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
                <span>Discount</span>
                <span className="font-semibold text-text-primary">₵ 0.00</span>
              </div>
              <div className="mt-4 border-t border-border pt-4 flex items-center justify-between text-lg font-black text-text-primary">
                <span>Total</span>
                <span>₵ {cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-brand-blue-light/40 p-4">
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Customer</p>
              <div className="mt-3 space-y-3">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                >
                  <option value="">Select a saved customer (optional)</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer name for receipt"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
                <button
                  type="button"
                  onClick={() => setShowNewCustomer((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-gray-50"
                >
                  <Plus size={16} /> Add new customer
                </button>
                {showNewCustomer && (
                  <div className="space-y-3 rounded-2xl border border-border bg-white p-3">
                    <input
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="New customer name"
                      className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    />
                    <input
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="Phone (optional)"
                      className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomer}
                      className="w-full rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-blue-dark"
                    >
                      Save Customer
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-white p-4">
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Payment</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Cash</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmounts.cash}
                    onChange={(e) => setPaymentAmount('cash', e.target.value)}
                    placeholder={cartTotal.toFixed(2)}
                    className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">MoMo</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmounts.momo}
                    onChange={(e) => setPaymentAmount('momo', e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Advance</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmounts.advance}
                    onChange={(e) => setPaymentAmount('advance', e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Credit</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmounts.credit}
                    onChange={(e) => setPaymentAmount('credit', e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  />
                </label>
              </div>

              {Number(paymentAmounts.momo) > 0 && (
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-text-primary mb-2">MoMo reference</label>
                  <input
                    type="text"
                    value={momoReference}
                    onChange={(e) => setMomoReference(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    placeholder="Enter transaction reference"
                  />
                </div>
              )}

              {(Number(paymentAmounts.advance) > 0 || Number(paymentAmounts.credit) > 0) && (
                <p className="mt-4 rounded-2xl bg-warning-light px-4 py-3 text-sm text-warning">
                  Credit and advance balance sales require a saved customer.
                </p>
              )}
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-brand-blue px-6 py-4 text-lg font-black text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark disabled:bg-gray-200 disabled:text-gray-500"
            >
              COMPLETE SALE
            </button>

            <button
              onClick={handlePrint}
              disabled={!lastSale}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-border bg-white px-6 py-4 text-sm font-semibold text-text-primary transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer size={18} /> Print Receipt
            </button>
          </div>
        </aside>
      </main>

      <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">Total</p>
            <p className="mt-1 text-lg font-black text-text-primary">₵ {cartTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:bg-gray-200 disabled:text-gray-500"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}
