import { useState, useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie'
import { addCustomerToQueue, addToQueue } from '../db/syncQueue'
import { getProducts } from '../api/products'
import { createCustomer, getCustomers } from '../api/customers'
import { useAuth } from '../hooks/useAuth'
import { useRemoteRefresh } from '../hooks/useRemoteRefresh'
import { getReceiptHtml, printReceipt } from '../utils/receiptGenerator'
import StatusPopup from '../components/StatusPopup'
import { ShoppingCart, Search, Trash2, Plus, Minus, Printer, Wifi, WifiOff, X } from 'lucide-react'

export default function Home() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [cart, setCart] = useState([])
  const [lastSale, setLastSale] = useState(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [paymentType, setPaymentType] = useState('FULL')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paidAmount, setPaidAmount] = useState('')
  const [discount, setDiscount] = useState('')
  const [momoReference, setMomoReference] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState(null)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [pendingSale, setPendingSale] = useState(null)

  const liveProducts = useLiveQuery(() => db.products.toArray())
  const liveCustomers = useLiveQuery(() => db.customers.where('active').notEqual(0).toArray())
  const products = useMemo(() => liveProducts || [], [liveProducts])
  const customers = useMemo(() => liveCustomers || [], [liveCustomers])

  const refreshRemoteData = async () => {
    try {
      await Promise.all([getProducts(), getCustomers()])
    } catch {
      console.warn('Could not refresh server data, using local cache.')
    }
  }

  useEffect(() => {
    refreshRemoteData()
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  useRemoteRefresh(refreshRemoteData)

  const categories = useMemo(() => {
    const names = new Set(products.map((product) => product.category?.name || 'Other'))
    return ['All', ...Array.from(names)]
  }, [products])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products
      .filter((product) => {
        const matchName = product.name?.toLowerCase().includes(query)
        const matchCategory = product.category?.name?.toLowerCase().includes(query)
        return !query || matchName || matchCategory
      })
      .filter((product) => activeCategory === 'All' || product.category?.name === activeCategory)
  }, [products, search, activeCategory])

  const parseAmount = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  const getLineUnitPrice = (item) => {
    const wholesalePrice = Number(item.wholesalePrice)
    if (Number.isFinite(wholesalePrice) && wholesalePrice > 0 && item.quantity >= 2 && item.unitsPerBase > 1) {
      return wholesalePrice
    }
    return Number(item.price) || 0
  }

  const addToCart = (product) => {
    setCheckoutMessage(null)
    if (lastSale && cart.length === 0) {
      setLastSale(null)
    }

    const isOutOfStock = product.stock <= 0
    const isExpired = product.expired || (product.expiryDate && new Date(product.expiryDate) <= new Date())

    if (isOutOfStock) {
      alert('This product is out of stock.')
      return
    }

    if (isExpired) {
      alert('This product has expired and cannot be sold.')
      return
    }

    setCart((prev) => {
      const defaultPackage = product.packageOptions?.find((option) => option.isDefault && option.active !== false)
        || product.packageOptions?.find((option) => option.active !== false)
        || null
      const unitsPerBase = defaultPackage?.unitsPerBase || 1
      if (unitsPerBase > product.stock) {
        alert('Not enough stock for this package option.')
        return prev
      }
      const cartProduct = {
        ...product,
        packageOptionId: defaultPackage?.id,
        packageName: defaultPackage?.name || 'Unit',
        unitsPerBase,
        price: defaultPackage?.price ?? product.price,
        wholesalePrice: defaultPackage?.wholesalePrice,
        baseQuantity: unitsPerBase,
      }
      const existing = prev.find((item) => item.id === product.id && item.packageOptionId === cartProduct.packageOptionId)
      if (existing) {
        const nextBaseQuantity = existing.baseQuantity + existing.unitsPerBase
        if (nextBaseQuantity > product.stock) {
          alert('Cannot add more than available stock.')
          return prev
        }
        return prev.map((item) => (
          item.id === product.id && item.packageOptionId === cartProduct.packageOptionId
            ? { ...item, quantity: item.quantity + 1, baseQuantity: (item.quantity + 1) * item.unitsPerBase }
            : item
        ))
      }
      return [...prev, { ...cartProduct, quantity: 1 }]
    })
  }

  const updateQuantity = (id, packageOptionId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id || item.packageOptionId !== packageOptionId) return item
          const nextQuantity = item.quantity + delta
          if (nextQuantity <= 0) return null
          if (nextQuantity * item.unitsPerBase > item.stock) {
            alert('Cannot exceed available stock.')
            return item
          }
          return { ...item, quantity: nextQuantity, baseQuantity: nextQuantity * item.unitsPerBase }
        })
        .filter(Boolean)
    )
  }

  const updatePackageOption = (id, currentPackageOptionId, nextPackageOptionId) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id || item.packageOptionId !== currentPackageOptionId) return item
      const option = item.packageOptions?.find((packageOption) => packageOption.id === nextPackageOptionId)
      if (!option) return item
      if (item.quantity * option.unitsPerBase > item.stock) {
        alert('Not enough stock for this package option.')
        return item
      }
      return {
        ...item,
        packageOptionId: option.id,
        packageName: option.name,
        unitsPerBase: option.unitsPerBase,
        price: option.price,
        wholesalePrice: option.wholesalePrice,
        baseQuantity: item.quantity * option.unitsPerBase,
      }
    }))
  }

  const removeFromCart = (id, packageOptionId) => {
    setCart((prev) => prev.filter((item) => !(item.id === id && item.packageOptionId === packageOptionId)))
  }

  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + getLineUnitPrice(item) * item.quantity, 0), [cart])
  const cartTotal = useMemo(() => Math.max(0, cartSubtotal - parseAmount(discount)), [cartSubtotal, discount])

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (query.length < 2) return []

    return customers.filter((customer) => {
      return customer.name?.toLowerCase().includes(query) || customer.phone?.includes(query)
    })
  }, [customers, customerSearch])

  const paymentInfo = useMemo(() => {
    const paid = parseAmount(paidAmount)
    const difference = paid - cartTotal
    if (paymentType === 'FULL') {
      return {
        status: paid >= cartTotal ? 'change' : 'insufficient',
        amount: Math.abs(difference),
      }
    }
    return {
      status: 'balance',
      amount: Math.max(0, cartTotal - paid),
    }
  }, [paidAmount, cartTotal, paymentType])

  const saleCompleted = Boolean(lastSale) && cart.length === 0
  const customerQueryReady = customerSearch.trim().length >= 2

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) return

    const payload = { name: newCustomerName.trim(), phone: newCustomerPhone.trim() || undefined }
    try {
      const customer = online ? await createCustomer(payload) : await addCustomerToQueue(payload)
      await db.customers.put({ ...customer, synced: online ? 1 : 0 })
      setSelectedCustomerId(customer.id)
      setCustomerSearch(customer.name)
      setNewCustomerName('')
      setNewCustomerPhone('')
      setShowNewCustomer(false)
      setCheckoutMessage({
        type: 'success',
        text: online ? `Customer ${customer.name} added.` : `Customer ${customer.name} saved locally and will sync when online.`,
      })
    } catch {
      setCheckoutMessage({ type: 'error', text: 'Failed to create customer.' })
    }
  }

  const buildSale = () => {
    const paid = parseAmount(paidAmount)
    const paymentLines = []
    if (paid > 0) {
      paymentLines.push({ method: paymentMethod, amount: paid, momoReference: paymentMethod === 'MOMO' ? momoReference.trim() : undefined })
    }
    const creditAmount = paymentType === 'CREDIT' ? Math.max(0, cartTotal - paid) : 0
    if (creditAmount > 0) {
      paymentLines.push({ method: 'CREDIT', amount: creditAmount })
    }

    const paymentStatus = paymentType === 'FULL' ? 'PAID' : paid > 0 ? 'PARTIAL' : 'CREDIT'

    return {
      clientId: crypto.randomUUID(),
      total: cartTotal,
      discount: parseAmount(discount),
      amountPaid: paid,
      creditAmount,
      paymentStatus,
      customerId: selectedCustomer?.synced === 0 ? undefined : selectedCustomerId || undefined,
      customerClientId: selectedCustomer?.synced === 0 ? selectedCustomer.clientId : undefined,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      cashierId: user.id,
      cashierName: user?.name,
      createdAt: new Date().toISOString(),
      items: cart.map((item) => ({
        productId: item.id,
        productName: item.name,
        packageOptionId: item.packageOptionId || undefined,
        packageName: item.packageName || item.category?.name || item.name,
        unitsPerBase: item.unitsPerBase || 1,
        quantity: item.quantity,
        baseQuantity: item.baseQuantity || item.quantity,
        unitPrice: getLineUnitPrice(item),
      })),
      paymentLines,
    }
  }

  const handleCheckout = () => {
    if (cart.length === 0) return

    const paid = parseAmount(paidAmount)
    if (paymentType === 'FULL' && paid < cartTotal) {
      alert('Please enter the full amount for a full payment sale.')
      return
    }
    if (paymentType === 'CREDIT' && !selectedCustomerId) {
      alert('Please select or add a customer for credit sales.')
      return
    }
    if (paymentMethod === 'ADVANCE_BALANCE') {
      if (!selectedCustomerId) {
        alert('Please select a customer to use advance balance.')
        return
      }
      if (paid <= 0) {
        alert('Enter the amount to deduct from the advance balance.')
        return
      }
      if (paid > Number(selectedCustomer?.currentBalance || 0)) {
        alert('Advance balance is not enough for this payment.')
        return
      }
    }
    if (paymentMethod === 'MOMO' && paid > 0 && !momoReference.trim()) {
      alert('Please enter a MoMo reference for mobile payments.')
      return
    }

    setPendingSale(buildSale())
    setShowReceiptPreview(true)
  }

  const saveAndPrintSale = async (sale) => {
    try {
      const result = await addToQueue(sale)
      setLastSale(sale)
      setPendingSale(null)
      setCart([])
      setDiscount('')
      setPaidAmount('')
      setSelectedCustomerId('')
      setCustomerSearch('')
      setMomoReference('')
      setShowCustomerDropdown(false)
      setShowNewCustomer(false)
      setCheckoutMessage({
        type: result.synced ? 'success' : 'warning',
        text: result.synced
          ? 'Sale completed and synced. Stock has been updated.'
          : `Sale saved locally. Stock was updated here and sync will retry. ${result.message || ''}`.trim(),
      })
      printReceipt(sale)
      setShowReceiptPreview(false)
    } catch {
      setCheckoutMessage({ type: 'error', text: 'Failed to save transaction locally.' })
    }
  }

  const handlePrint = () => {
    if (lastSale) {
      setPendingSale(null)
      setShowReceiptPreview(true)
    }
  }

  const handleConfirmPrint = async () => {
    if (pendingSale) {
      await saveAndPrintSale(pendingSale)
      return
    }
    if (!lastSale) return
    printReceipt(lastSale)
    setShowReceiptPreview(false)
  }

  const handleCancelReceiptPreview = () => {
    setShowReceiptPreview(false)
    setPendingSale(null)
  }

  return (
    <div className="flex min-h-full flex-col pb-28 xl:pb-0">
      <StatusPopup message={checkoutMessage} onClose={() => setCheckoutMessage(null)} />

      <div className={`rounded-3xl border border-border px-4 py-3 text-sm font-semibold mb-6 ${online ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
        <div className="flex items-center justify-center gap-2">
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online
            ? 'Online — transactions sync immediately.'
            : 'Offline — transactions save locally and sync when online.'}
        </div>
      </div>

      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 flex flex-col gap-6">
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border bg-brand-blue-light/40 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-text-primary">Product Catalog</h2>
                <p className="mt-1 text-sm text-text-secondary">Search and browse product categories.</p>
              </div>
              <div className="relative w-full max-w-md">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products or categories"
                  className="w-full rounded-full border border-border bg-white py-3 pl-12 pr-4 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-4 sm:px-6 overflow-x-auto">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === category ? 'bg-brand-blue text-white shadow-sm' : 'bg-white border border-border text-text-secondary hover:bg-gray-50'}`}>
                  {category}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stock <= 0
                  const isExpired = product.expired || (product.expiryDate && new Date(product.expiryDate) <= new Date())
                  const disabled = isOutOfStock || isExpired
                  const selected = cart.some((item) => item.id === product.id)

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={disabled}
                      className={`group relative flex min-h-[156px] flex-col justify-between overflow-hidden rounded-3xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-float ${selected ? 'border-brand-blue' : 'border-border'} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <div>
                        <h3 className="text-base font-semibold text-text-primary line-clamp-2">{product.name}</h3>
                        <p className="mt-2 text-sm text-text-secondary">{product.category?.name || 'Other'}</p>
                        <p className="mt-3 text-lg font-black text-brand-blue">GH₵ {Number(product.price).toFixed(2)}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                        <span className={`rounded-full px-3 py-1 ${isOutOfStock ? 'bg-slate-200 text-slate-600' : product.stock <= 5 ? 'bg-warning-light text-warning' : 'bg-brand-blue-light text-brand-blue'}`}>
                          {isOutOfStock ? 'OUT' : `${product.stock} in stock`}
                        </span>
                        {isExpired && <span className="rounded-full bg-danger-light px-3 py-1 text-danger">EXPIRED</span>}
                        <span className="text-text-secondary">Tap to add</span>
                      </div>
                      {disabled && (
                        <div className="absolute inset-0 rounded-3xl bg-slate-900/55 flex items-center justify-center text-sm font-semibold text-white">
                          {isExpired ? 'Expired' : 'Out of stock'}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="mt-10 flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-gray-50 p-10 text-center text-text-secondary">
                  <p className="mt-4 text-base font-semibold">No products match your search.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="lg:col-span-1 xl:sticky xl:top-4 xl:self-start">
          <div className="card flex h-full flex-col p-6">
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
                        <p className="mt-1 text-sm text-text-secondary">GH₵ {getLineUnitPrice(item).toFixed(2)} each</p>
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
                          <option key={option.id} value={option.id}>{option.name} - GH₵ {Number(option.price).toFixed(2)}</option>
                        ))}
                      </select>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex items-center rounded-full border border-border bg-white px-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.packageOptionId, -1)}
                          className="p-2 text-text-secondary hover:text-text-primary transition"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="mx-3 text-sm font-black">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.packageOptionId, 1)}
                          className="p-2 text-text-secondary hover:text-text-primary transition"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="text-sm font-black text-text-primary">GH₵ {(getLineUnitPrice(item) * item.quantity).toFixed(2)}</p>
                    </div>
                    {item.unitsPerBase > 1 && (
                      <p className="mt-2 text-xs font-semibold text-text-secondary">
                        {item.baseQuantity} bottles deducted
                        {Number(item.wholesalePrice) > 0 && item.quantity >= 2 ? ' - wholesale applied' : ''}
                      </p>
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
                <span className="font-semibold text-text-primary">GH₵ {cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
                <span className="flex items-center gap-1">Discount <span className="text-[10px] bg-brand-blue-light text-brand-blue px-1 rounded">GH₵</span></span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  placeholder="0.00"
                  className="w-24 rounded-lg border border-border bg-gray-50 px-2 py-1 text-right text-sm font-semibold text-text-primary outline-none focus:border-brand-blue"
                />
              </div>
              <div className="mt-4 border-t border-border pt-4 flex items-center justify-between text-lg font-black text-text-primary">
                <span>Total</span>
                <span>GH₵ {cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-brand-blue-light/40 p-4">
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Payment type</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('FULL')}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${paymentType === 'FULL' ? 'bg-brand-blue text-white' : 'bg-white text-text-primary border border-border hover:bg-gray-50'}`}>
                  Full Payment
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentType('CREDIT')}
                  className={`rounded-3xl px-4 py-3 text-sm font-semibold transition ${paymentType === 'CREDIT' ? 'bg-brand-blue text-white' : 'bg-white text-text-primary border border-border hover:bg-gray-50'}`}>
                  Credit
                </button>
              </div>

              {(paymentType === 'CREDIT' || paymentMethod === 'ADVANCE_BALANCE') && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setSelectedCustomerId('')
                        setShowCustomerDropdown(true)
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search customer by name or phone"
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    />
                    {showCustomerDropdown && customerQueryReady && filteredCustomers.length > 0 && (
                      <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-56 overflow-y-auto rounded-3xl border border-border bg-white shadow-lg">
                        {filteredCustomers.slice(0, 6).map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(customer.id)
                              setCustomerSearch(customer.name)
                              setShowCustomerDropdown(false)
                            }}
                            className="w-full px-4 py-3 text-left text-sm text-text-primary hover:bg-gray-50"
                          >
                            <div className="font-semibold">{customer.name}</div>
                            <div className="text-xs text-text-secondary">{customer.phone}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showCustomerDropdown && customerQueryReady && filteredCustomers.length === 0 && (
                      <div className="absolute inset-x-0 top-full z-20 mt-2 rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-secondary shadow-lg">
                        No matching customer found.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewCustomer((value) => !value)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-3xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-gray-50"
                  >
                    <Plus size={16} /> Add new customer
                  </button>

                  {showNewCustomer && (
                    <div className="space-y-3 rounded-3xl border border-border bg-white p-4">
                      <input
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Customer full name"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                      <input
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCustomer}
                        className="w-full rounded-2xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark"
                      >
                        Save Customer
                      </button>
                    </div>
                  )}

                  {selectedCustomer && (
                    <div className="rounded-3xl border border-border bg-white p-4 text-sm text-text-secondary">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-text-primary">Selected customer</p>
                          <p className="mt-1">{selectedCustomer.name}</p>
                          <p className="text-xs">{selectedCustomer.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider">Balance</p>
                          <p className={`text-base font-black ${selectedCustomer.currentBalance >= 0 ? 'text-success' : 'text-danger'}`}>
                            GH₵ {Number(selectedCustomer.currentBalance || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-border bg-white p-4">
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Payment method</p>
              <div className="mt-3 space-y-4">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                >
                  <option value="CASH">Cash</option>
                  <option value="MOMO">Mobile Money</option>
                  <option value="ADVANCE_BALANCE">Advance Balance (Wallet)</option>
                </select>

                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">Amount Paid</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    placeholder="0.00"
                  />
                </label>

                {paymentMethod === 'MOMO' && (
                  <div>
                    <label className="block text-sm font-semibold text-text-secondary mb-2">MoMo reference</label>
                    <input
                      type="text"
                      value={momoReference}
                      onChange={(e) => setMomoReference(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                      placeholder="Enter transaction reference"
                    />
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm">
                {paymentInfo.status === 'change' ? (
                  <p className="text-success">Change: GH₵ {paymentInfo.amount.toFixed(2)}</p>
                ) : paymentInfo.status === 'insufficient' ? (
                  <p className="text-danger">Insufficient amount</p>
                ) : (
                  <p className="text-danger">Balance due: GH₵ {paymentInfo.amount.toFixed(2)}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {!saleCompleted && (
                <button
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || (paymentType === 'FULL' && parseAmount(paidAmount) < cartTotal) || (paymentType === 'CREDIT' && !selectedCustomerId) || (paymentMethod === 'ADVANCE_BALANCE' && !selectedCustomerId)}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-brand-blue px-6 py-4 text-lg font-black text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark disabled:bg-gray-200 disabled:text-gray-500"
                >
                  COMPLETE SALE
                </button>
              )}
              {saleCompleted && (
                <button
                  onClick={handlePrint}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-brand-blue px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark"
                >
                  <Printer size={18} /> Print Receipt
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Are you sure you want to clear the cart?')) return
                  setCart([])
                  setLastSale(null)
                  setPendingSale(null)
                  setCheckoutMessage(null)
                  setShowReceiptPreview(false)
                  setPaidAmount('')
                  setSelectedCustomerId('')
                  setCustomerSearch('')
                  setMomoReference('')
                  setShowNewCustomer(false)
                }}
                className="inline-flex w-full items-center justify-center gap-3 rounded-3xl border border-border bg-white px-6 py-4 text-sm font-semibold text-text-primary transition hover:bg-gray-50"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </aside>
      </main>

      {!saleCompleted && (
      <div className="xl:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">Total</p>
            <p className="mt-1 text-lg font-black text-text-primary">GH₵ {cartTotal.toFixed(2)}</p>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || (paymentType === 'FULL' && parseAmount(paidAmount) < cartTotal) || (paymentType === 'CREDIT' && !selectedCustomerId) || (paymentMethod === 'ADVANCE_BALANCE' && !selectedCustomerId)}
            className="rounded-3xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:bg-gray-200 disabled:text-gray-500"
          >
            Complete Sale
          </button>
        </div>
      </div>
      )}

      {showReceiptPreview && (pendingSale || lastSale) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Receipt Preview</p>
                <h2 className="mt-1 text-lg font-black text-text-primary">Confirm Sale?</h2>
              </div>
              <button
                type="button"
                onClick={handleCancelReceiptPreview}
                className="rounded-2xl border border-border bg-white p-2 text-text-secondary transition hover:bg-gray-50"
                aria-label="Close receipt preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-100 px-4 py-5">
              <div className="mx-auto w-[320px] max-w-full overflow-hidden bg-white shadow-lg ring-1 ring-slate-200">
                <iframe
                  title="Receipt preview"
                  srcDoc={getReceiptHtml(pendingSale || lastSale)}
                  className="h-[620px] w-full border-0 bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-white px-5 py-4">
              <button
                type="button"
                onClick={handleCancelReceiptPreview}
                className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-secondary transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPrint}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark"
              >
                <Printer size={17} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
