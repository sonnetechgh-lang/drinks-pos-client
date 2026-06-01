import { useState, useEffect } from 'react'
import { getSalesReport, getBestSellingProducts } from '../api/sales'
import { getLowStockProducts } from '../api/products'
import { ChevronRight, Download, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Reports() {
  const [reportType, setReportType] = useState('sales')
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState('')
  const [salesData, setSalesData] = useState([])
  const [bestSellingData, setBestSellingData] = useState([])
  const [lowStockData, setLowStockData] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalSales, setTotalSales] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => {
    fetchReportData()
  }, [reportType])

  const fetchReportData = async () => {
    setLoading(true)
    try {
      if (reportType === 'sales') {
        const result = await getSalesReport(startDate, endDate, paymentStatus || undefined)
        setSalesData(Array.isArray(result) ? result : [])
        setTotalSales(result?.length || 0)
        const revenue = (Array.isArray(result) ? result : []).reduce((sum, sale) => sum + (sale.total || 0), 0)
        setTotalRevenue(revenue)
      } else if (reportType === 'best-selling') {
        const result = await getBestSellingProducts(20)
        setBestSellingData(Array.isArray(result) ? result : [])
      } else if (reportType === 'low-stock') {
        const result = await getLowStockProducts(100)
        setLowStockData(Array.isArray(result) ? result : [])
      }
    } catch (error) {
      console.error('Failed to fetch report data', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = () => {
    if (reportType === 'sales') {
      fetchReportData()
    }
  }

  const exportToCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,'
    let headers = []
    let rows = []

    if (reportType === 'sales') {
      headers = ['Sale ID', 'Date', 'Customer', 'Total', 'Payment Status']
      rows = salesData.map((sale) => [
        sale.clientId,
        new Date(sale.createdAt).toLocaleString(),
        sale.customer?.name || 'Cash Sale',
        sale.total.toFixed(2),
        sale.paymentStatus
      ])
    } else if (reportType === 'best-selling') {
      headers = ['Rank', 'Product Name', 'Units Sold', 'Revenue']
      rows = bestSellingData.map((product, index) => [
        index + 1,
        product.name,
        product.quantity,
        product.revenue?.toFixed(2) || 0
      ])
    } else if (reportType === 'low-stock') {
      headers = ['Product Name', 'Current Stock', 'Category']
      rows = lowStockData.map((product) => [
        product.name,
        product.stock,
        product.category?.name || 'Uncategorized'
      ])
    }

    csvContent += headers.join(',') + '\n'
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${cell}"`).join(',') + '\n'
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-7xl mx-auto min-h-full space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Analytics</p>
          <h1 className="mt-2 text-3xl font-black text-text-primary">Reports</h1>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-3xl border border-border bg-white px-4 py-3 text-sm font-semibold text-text-primary shadow-sm hover:bg-gray-50 transition"
        >
          <ChevronRight size={16} /> Back to Dashboard
        </Link>
      </div>

      {/* Report Type Selector */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary mb-4">Report Type</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'sales', label: 'Sales Report' },
            { value: 'best-selling', label: 'Best Selling Products' },
            { value: 'low-stock', label: 'Low Stock Alert' }
          ].map((type) => (
            <button
              key={type.value}
              onClick={() => setReportType(type.value)}
              className={`px-4 py-2 rounded-2xl font-semibold text-sm transition ${
                reportType === type.value
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 text-text-primary hover:bg-gray-200'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      {reportType === 'sales' && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-secondary mb-4">Filters</h2>
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary mb-2">Start Date</label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-text-secondary" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-2xl border border-border bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary mb-2">End Date</label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-text-secondary" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-2xl border border-border bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary mb-2">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-2xl border border-border bg-white text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
              >
                <option value="">All Status</option>
                <option value="PAID">Paid</option>
                <option value="PARTIAL">Partial</option>
                <option value="CREDIT">Credit</option>
              </select>
            </div>
            <button
              onClick={handleFilterChange}
              className="px-4 py-2 rounded-2xl bg-brand-blue text-white font-semibold text-sm hover:bg-brand-blue/90 transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {reportType === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 bg-brand-blue-light border-l-4 border-brand-blue">
            <p className="text-xs font-semibold text-text-secondary uppercase">Total Transactions</p>
            <p className="mt-2 text-3xl font-black text-brand-blue">{totalSales}</p>
          </div>
          <div className="card p-6 bg-success-light border-l-4 border-success">
            <p className="text-xs font-semibold text-text-secondary uppercase">Total Revenue</p>
            <p className="mt-2 text-3xl font-black text-success">₵ {totalRevenue.toFixed(2)}</p>
          </div>
          <div className="card p-6 bg-info-light border-l-4 border-info">
            <p className="text-xs font-semibold text-text-secondary uppercase">Average Sale</p>
            <p className="mt-2 text-3xl font-black text-info">₵ {(totalSales > 0 ? totalRevenue / totalSales : 0).toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary">
            {reportType === 'sales' ? 'Sales Transactions' : reportType === 'best-selling' ? 'Best Selling Products' : 'Low Stock Items'}
          </h2>
          <button
            onClick={exportToCSV}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-text-secondary">Loading...</div>
        ) : reportType === 'sales' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">Sale ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">Date & Time</th>
                  <th className="px-4 py-3 text-left font-semibold text-text-secondary">Customer</th>
                  <th className="px-4 py-3 text-right font-semibold text-text-secondary">Total</th>
                  <th className="px-4 py-3 text-center font-semibold text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {salesData.length > 0 ? (
                  salesData.map((sale) => (
                    <tr key={sale.id} className="border-b border-border hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{sale.clientId}</td>
                      <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{sale.customer?.name || 'Cash Sale'}</td>
                      <td className="px-4 py-3 text-right font-semibold">₵ {sale.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            sale.paymentStatus === 'PAID'
                              ? 'bg-success-light text-success'
                              : sale.paymentStatus === 'PARTIAL'
                                ? 'bg-warning-light text-warning'
                                : 'bg-danger-light text-danger'
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-text-secondary">
                      No sales data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : reportType === 'best-selling' ? (
          <div className="space-y-3">
            {bestSellingData.length > 0 ? (
              bestSellingData.map((product, index) => (
                <div key={product.productId || index} className="flex items-center justify-between rounded-2xl bg-gray-50 p-4 border border-border">
                  <div className="flex items-center gap-4 flex-1">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-blue text-white font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-text-primary">{product.name}</p>
                      <p className="text-xs text-text-secondary">{product.quantity} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text-primary">₵ {product.revenue?.toFixed(2) || 0}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-text-secondary">No product data found</div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {lowStockData.length > 0 ? (
              lowStockData.map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-2xl bg-gray-50 p-4 border border-warning/20">
                  <div className="flex-1">
                    <p className="font-semibold text-text-primary">{product.name}</p>
                    <p className="text-xs text-text-secondary">{product.category?.name || 'Uncategorized'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-warning-light text-warning text-xs font-semibold">
                    {product.stock} units
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-text-secondary">No low stock items</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
