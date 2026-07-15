import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getTodayTotal, getBestSellingProducts, getTodaySales, getOutstandingCredit } from '../api/sales'
import { getProductCount, getLowStockProducts } from '../api/products'
import { getTopDebtors } from '../api/customers'
import { db } from '../db/dexie'
import { useRemoteRefresh } from '../hooks/useRemoteRefresh'
import { ChevronRight, AlertCircle, Package, AlertTriangle, Banknote, CreditCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import Skeleton from '../components/Skeleton'
import ErrorBanner from '../components/ErrorBanner'

export default function Dashboard() {
  const [todayTotal, setTodayTotal] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [outstandingCredit, setOutstandingCredit] = useState(0)
  const [bestSellingProducts, setBestSellingProducts] = useState([])
  const [lowStockProducts, setLowStockProducts] = useState([])
  const [todaySales, setTodaySales] = useState([])
  const [topDebtors, setTopDebtors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ... (rest of the logic remains the same)

  const fetchData = async () => {
    try {
      const [todayData, countData, lowStockData, creditData, bestData, lowData, salesData, debtorsData] = await Promise.all([
        getTodayTotal(),
        getProductCount(),
        getLowStockProducts(100),
        getOutstandingCredit(),
        getBestSellingProducts(5),
        getLowStockProducts(8),
        getTodaySales(5),
        getTopDebtors(5)
      ])

      setTodayTotal(todayData?.total || 0)
      setProductCount(countData?.count || 0)
      setLowStockCount(Array.isArray(lowStockData) ? lowStockData.length : 0)
      setOutstandingCredit(creditData?.outstanding || 0)
      setBestSellingProducts(Array.isArray(bestData) ? bestData : [])
      setLowStockProducts(Array.isArray(lowData) ? lowData : [])
      setTodaySales(Array.isArray(salesData) ? salesData : [])
      setTopDebtors(Array.isArray(debtorsData) ? debtorsData : [])
      setError('')
    } catch (error) {
      setError(error.response?.data?.message || error.message || 'Failed to load dashboard data.')
      console.error('Failed to fetch dashboard data', error)
    } finally {
      setLoading(false)
    }
  }

  useRemoteRefresh(fetchData)

  const localProducts = useLiveQuery(() => db.products.toArray()) || []
  const localCustomers = useLiveQuery(() => db.customers.toArray()) || []
  const queuedRecords = useLiveQuery(() => db.syncQueue.where('synced').equals(0).toArray()) || []

  if (loading) {
    return (
      <div className="mx-auto min-h-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-12 w-32 rounded-3xl" />
        </div>

        <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 space-y-6">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
          <div className="xl:col-span-4 space-y-6">
            <Skeleton className="h-80 rounded-3xl" />
            <Skeleton className="h-80 rounded-3xl" />
          </div>
        </div>
      </div>
    )
  }

  const todayKey = new Date().toDateString()
  const queuedSales = queuedRecords.filter((record) => !record.type || record.type === 'SALE')
  const queuedPayments = queuedRecords.filter((record) => record.type === 'CUSTOMER_PAYMENT')
  const unsyncedTodaySales = queuedSales.filter((sale) => new Date(sale.createdAt).toDateString() === todayKey)
  const localProductCount = localProducts.length
  const isLowStock = (product) => Number(product.stock || 0) <= Number(product.lowStockThreshold ?? 5)
  const localLowStockProducts = localProducts.filter(isLowStock)
  const displayProductCount = Math.max(productCount, localProductCount)
  const displayLowStockProducts = [
    ...lowStockProducts,
    ...localLowStockProducts.filter((localProduct) => !lowStockProducts.some((product) => product.id === localProduct.id)),
  ].slice(0, 8)
  const displayLowStockCount = Math.max(lowStockCount, displayLowStockProducts.length, localLowStockProducts.length)
  const displayTodayTotal = todayTotal + unsyncedTodaySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0)
  const displayOutstandingCredit = Math.max(
    0,
    outstandingCredit
      + queuedSales.reduce((sum, sale) => sum + Number(sale.creditAmount || 0), 0)
      - queuedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  )
  const displayTodaySales = [
    ...unsyncedTodaySales.map((sale) => ({ ...sale, pendingSync: true })),
    ...todaySales,
  ].slice(0, 5)
  const displayTopDebtors = topDebtors.length > 0
    ? topDebtors
    : localCustomers
      .filter((customer) => Number(customer.balance || customer.outstandingBalance || 0) > 0)
      .sort((a, b) => Number(b.balance || b.outstandingBalance || 0) - Number(a.balance || a.outstandingBalance || 0))
      .slice(0, 5)

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Overview</p>
          <h1 className="mt-2 text-3xl font-black text-text-primary">Dashboard</h1>
        </div>
        <Link
          to="/pos"
          className="inline-flex items-center gap-2 rounded-3xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-sm hover:bg-gray-50 transition"
        >
          <ChevronRight size={16} /> Go to POS
        </Link>
      </div>

      <ErrorBanner message={error} onRetry={fetchData} />

      {/* Stat Cards - 2x2 on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 gap-4 md:gap-5 xl:grid-cols-4">
        <StatCard label="Total Products" value={displayProductCount} icon={Package} tone="blue" />
        <StatCard label="Low Stock Items" value={displayLowStockCount} icon={AlertTriangle} tone="amber" />
        <StatCard label="Today's Sales" value={`GHS ${displayTodayTotal.toFixed(2)}`} icon={Banknote} tone="green" />
        <StatCard label="Outstanding Credit" value={`GHS ${displayOutstandingCredit.toFixed(2)}`} icon={CreditCard} tone="red" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left Section - 8 columns */}
        <section className="xl:col-span-8 space-y-6">
          {/* Best Selling Products */}
          <div className="card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-text-primary">Best Selling Products</h2>
              <p className="text-sm text-text-secondary">Top performing products by quantity sold</p>
            </div>
            {bestSellingProducts.length > 0 ? (
              <div className="space-y-3">
                {bestSellingProducts.map((product, index) => (
                  <div key={product.productId || index} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-3 border border-border">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-blue-light text-brand-blue text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-text-primary text-sm">{product.name}</p>
                        <p className="text-xs text-text-secondary">{product.quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-text-primary text-sm">GHS {product.revenue?.toFixed(2) || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary text-sm">No sales data available</p>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-warning" />
              <div>
                <h2 className="text-lg font-bold text-text-primary">Low Stock Alerts</h2>
                <p className="text-sm text-text-secondary">Products below threshold</p>
              </div>
            </div>
            {displayLowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {displayLowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-3 border border-warning/20">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{product.name}</p>
                      <p className="text-xs text-text-secondary">
                        {product.stock} in stock, threshold {Number(product.lowStockThreshold ?? 5)}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-semibold">
                      {product.stock} units
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary text-sm">No low stock items</p>
            )}
          </div>
        </section>

        {/* Right Section - 4 columns */}
        <aside className="xl:col-span-4 space-y-6">
          {/* Today's Sales */}
          <div className="card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-text-primary">Today's Sales</h2>
              <p className="text-xs text-text-secondary">Latest transactions</p>
            </div>
            {displayTodaySales.length > 0 ? (
              <div className="space-y-2">
                {displayTodaySales.map((sale, index) => (
                  <div key={sale.id || sale.clientId || index} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-2 text-xs border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{sale.customer?.name || sale.customerName || 'Cash Sale'}</p>
                      <p className="text-text-secondary">{new Date(sale.createdAt).toLocaleTimeString()}{sale.pendingSync ? ' - pending sync' : ''}</p>
                    </div>
                    <p className="font-semibold text-brand-blue ml-2">GHS {sale.total?.toFixed(2) || 0}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary text-sm">No sales today</p>
            )}
            <Link
              to="/reports"
              className="mt-4 w-full inline-flex items-center justify-center gap-1 rounded-2xl bg-brand-blue-light px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10 transition"
            >
              View All <ChevronRight size={14} />
            </Link>
          </div>

          {/* Top Debtors */}
          <div className="card p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-text-primary">Top Debtors</h2>
              <p className="text-xs text-text-secondary">Highest outstanding credit</p>
            </div>
            {displayTopDebtors.length > 0 ? (
              <div className="space-y-2">
                {displayTopDebtors.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-2 text-xs border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{customer.name}</p>
                      <p className="text-text-secondary">{customer.phone || 'No phone'}</p>
                    </div>
                    <p className="font-semibold text-danger ml-2 whitespace-nowrap">GHS {Number(customer.outstandingBalance ?? customer.balance ?? 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-text-secondary text-sm">No outstanding credit</p>
            )}
            <Link
              to="/customers"
              className="mt-4 w-full inline-flex items-center justify-center gap-1 rounded-2xl bg-brand-blue-light px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10 transition"
            >
              View All <ChevronRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

const statTones = {
  blue: {
    card: 'border-transparent bg-[#0B93F4]',
    icon: 'bg-white/20 text-white',
  },
  amber: {
    card: 'border-transparent bg-[#1A97F0]',
    icon: 'bg-white/20 text-white',
  },
  green: {
    card: 'border-transparent bg-[#F00A21]',
    icon: 'bg-white/20 text-white',
  },
  red: {
    card: 'border-transparent bg-[#B0210E]',
    icon: 'bg-white/20 text-white',
  },
}

function StatCard({ label, value, icon: Icon, tone = 'blue' }) {
  const color = statTones[tone] || statTones.blue

  return (
    <div className={`flex flex-col justify-between gap-3 rounded-3xl border p-4 shadow-sm sm:flex-row sm:items-start sm:gap-0 sm:p-6 text-white ${color.card}`}>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[10px] sm:text-sm font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-white/80 truncate">{label}</p>
        <p className="mt-1 sm:mt-4 text-lg sm:text-2xl font-black text-white truncate">{value}</p>
      </div>
      <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 self-end sm:self-auto shadow-sm ${color.icon}`}>
        <Icon size={20} className="sm:w-6 sm:h-6" />
      </div>
    </div>
  )
}
