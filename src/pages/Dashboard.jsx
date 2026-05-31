import { useState, useEffect } from 'react'
import { getSalesSummary } from '../api/sales'
import { TrendingUp, ChevronRight, BarChart3, Star, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData] = await Promise.all([getSalesSummary()])
        setSummary(summaryData)
      } catch (error) {
        console.error('Failed to fetch dashboard data', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8 text-center text-text-secondary">Loading dashboard...</div>
  if (!summary) return <div className="p-8 text-center text-danger">Failed to load dashboard data.</div>

  const { revenue, topProducts, repeatCustomerRate, totalCustomers, orderCount } = summary
  const orders = orderCount ?? 0
  const customers = totalCustomers ?? 0
  const repeatRate = repeatCustomerRate ?? 68
  const chartItems = topProducts.slice(0, 5)
  const maxQuantity = Math.max(...chartItems.map((product) => product.quantity), 1)

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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales Revenue" value={`₵ ${revenue.month.toFixed(2)}`} trend="+12.4%" />
        <StatCard label="Weekly Revenue" value={`₵ ${revenue.week.toFixed(2)}`} trend="+8.9%" />
        <StatCard label="Transactions" value={orders} trend="+5.2%" />
        <StatCard label="Accounts" value={customers} trend="+3.6%" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="xl:col-span-8 space-y-6">
          <div className="card p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary">Sales Revenue</p>
                <h2 className="mt-3 text-3xl font-black text-text-primary">₵ {revenue.month.toFixed(2)}</h2>
                <p className="mt-2 max-w-xl text-sm text-text-secondary">Review sales revenue and beverage performance in one place.</p>
              </div>
              <div className="rounded-3xl border border-border bg-brand-blue-light px-4 py-3 text-sm font-semibold text-brand-blue">
                <span className="inline-flex items-center gap-2"> <TrendingUp size={16} /> +14.2% vs last month</span>
              </div>
            </div>
            <div className="mt-8 rounded-3xl bg-bg-canvas p-6">
              <div className="h-48 rounded-3xl bg-white p-4 shadow-inner">
                {chartItems.length > 0 ? (
                  <div className="flex h-full items-end gap-3">
                    {chartItems.map((product) => (
                      <div key={product.name} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end rounded-2xl bg-brand-blue-light/60 p-1">
                          <div
                            className="w-full rounded-xl bg-brand-blue"
                            style={{ height: `${Math.max(12, (product.quantity / maxQuantity) * 100)}%` }}
                          />
                        </div>
                        <p className="w-full truncate text-center text-xs font-semibold text-text-secondary">{product.name}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-semibold text-text-secondary">
                    No sales trend data yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary">Best Selling Beverages</p>
                <p className="mt-2 text-sm text-text-secondary">Top performing SKUs for the current period.</p>
              </div>
              <span className="status-badge bg-brand-blue-light text-brand-blue">Top 5</span>
            </div>

            <div className="mt-6 space-y-4">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between rounded-3xl bg-gray-50 px-4 py-4">
                  <div>
                    <p className="font-semibold text-text-primary">{product.name}</p>
                    <p className="text-sm text-text-secondary">{product.quantity} sold</p>
                  </div>
                  <div className="rounded-full bg-brand-blue-light px-3 py-1 text-sm font-semibold text-brand-blue">{product.quantity}</div>
                </div>
              ))}
              {topProducts.length === 0 && <p className="text-center text-text-secondary">No sales data available.</p>}
            </div>
          </div>
        </section>

        <aside className="xl:col-span-4 space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Most Active Day</p>
                <h3 className="mt-3 text-2xl font-black text-text-primary">Tuesday</h3>
              </div>
              <BarChart3 size={28} className="text-brand-blue" />
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center rounded-3xl bg-brand-blue-light/80 p-3 text-sm font-semibold text-brand-blue">
              <div>
                <span className="block text-2xl">8,162</span>
                <span className="text-text-secondary">Sales</span>
              </div>
              <div>
                <span className="block text-2xl">18%</span>
                <span className="text-text-secondary">Change</span>
              </div>
              <div>
                <span className="block text-2xl">24h</span>
                <span className="text-text-secondary">Trend</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Repeat Customer Rate</p>
                <h3 className="mt-3 text-3xl font-black text-text-primary">{repeatRate}%</h3>
              </div>
              <Star size={28} className="text-brand-blue" />
            </div>
            <div className="mt-6 h-40 rounded-[28px] bg-success-light p-4">
              <div className="h-4 rounded-full bg-brand-blue-light">
                <div className="h-4 rounded-full bg-brand-blue" style={{ width: `${repeatRate}%` }} />
              </div>
              <p className="mt-4 text-sm text-text-secondary">On track for 80% target.</p>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">AI Assistant</p>
                <h3 className="mt-3 text-lg font-black text-text-primary">Insights & quick actions</h3>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-blue text-white">
                <Sparkles size={24} />
              </div>
            </div>
            <p className="mt-4 text-sm text-text-secondary">Ask the assistant to analyze trends, find top categories, or review stock alerts.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StatCard({ label, value, trend }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary">{label}</p>
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-blue">{trend}</span>
      </div>
      <p className="mt-6 text-3xl font-black text-text-primary">{value}</p>
      <p className="mt-3 text-sm text-text-secondary">Performance compared to previous period.</p>
    </div>
  )
}
