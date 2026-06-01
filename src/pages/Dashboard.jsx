import { useState, useEffect } from 'react'
import { getTodayTotal, getBestSellingProducts, getTodaySales, getOutstandingCredit } from '../api/sales'
import { getProductCount, getLowStockProducts } from '../api/products'
import { getTopDebtors } from '../api/customers'
import { TrendingUp, ChevronRight, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

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

  useEffect(() => {
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
      } catch (error) {
        console.error('Failed to fetch dashboard data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading dashboard...</div>

  return (
    <div className="max-w-7xl mx-auto min-h-full space-y-8">
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

      {/* Stat Cards - 4 Columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Products" value={productCount} icon="📦" />
        <StatCard label="Low Stock Items" value={lowStockCount} icon="⚠️" />
        <StatCard label="Today's Sales" value={`₵ ${todayTotal.toFixed(2)}`} icon="💰" />
        <StatCard label="Outstanding Credit" value={`₵ ${outstandingCredit.toFixed(2)}`} icon="💳" />
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
                      <p className="font-semibold text-text-primary text-sm">₵ {product.revenue?.toFixed(2) || 0}</p>
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
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-3 border border-warning/20">
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{product.name}</p>
                      <p className="text-xs text-text-secondary">{product.stock} in stock</p>
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
            {todaySales.length > 0 ? (
              <div className="space-y-2">
                {todaySales.map((sale, index) => (
                  <div key={sale.id || index} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-2 text-xs border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{sale.customer?.name || 'Cash Sale'}</p>
                      <p className="text-text-secondary">{new Date(sale.createdAt).toLocaleTimeString()}</p>
                    </div>
                    <p className="font-semibold text-brand-blue ml-2">₵ {sale.total?.toFixed(2) || 0}</p>
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
            {topDebtors.length > 0 ? (
              <div className="space-y-2">
                {topDebtors.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between rounded-2xl bg-bg-canvas p-2 text-xs border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary truncate">{customer.name}</p>
                      <p className="text-text-secondary">{customer.phone || 'No phone'}</p>
                    </div>
                    <p className="font-semibold text-danger ml-2 whitespace-nowrap">₵ {customer.outstandingBalance?.toFixed(2) || 0}</p>
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

function StatCard({ label, value, icon }) {
  return (
    <div className="card p-6 flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary">{label}</p>
        <p className="mt-4 text-2xl font-black text-text-primary">{value}</p>
      </div>
      <span className="text-4xl">{icon}</span>
    </div>
  )
}
