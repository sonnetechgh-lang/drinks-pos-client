import { useState } from 'react'
import { getSalesReport, getBestSellingProducts } from '../api/sales'
import { getLowStockProducts } from '../api/products'
import { ChevronRight, Calendar, Eye, FileText, Printer, Table, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { exportToExcel, exportToPDF } from '../utils/exportUtils'
import { useRemoteRefresh } from '../hooks/useRemoteRefresh'
import ErrorBanner from '../components/ErrorBanner'
import { getReceiptHtml, printReceipt } from '../utils/receiptGenerator'

export default function Reports() {
  const [reportType, setReportType] = useState('sales')
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentStatus, setPaymentStatus] = useState('')
  const [salesData, setSalesData] = useState([])
  const [bestSellingData, setBestSellingData] = useState([])
  const [lowStockData, setLowStockData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totalSales, setTotalSales] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [receiptSale, setReceiptSale] = useState(null)

  const fetchReportData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      if (reportType === 'sales') {
        const result = await getSalesReport(startDate, endDate, paymentStatus || undefined)
        setSalesData(Array.isArray(result) ? result : [])
        setTotalSales(result?.length || 0)
        const revenue = (Array.isArray(result) ? result : []).reduce((sum, sale) => sum + Number(sale.total || 0), 0)
        setTotalRevenue(revenue)
      } else if (reportType === 'best-selling') {
        const result = await getBestSellingProducts(20)
        setBestSellingData(Array.isArray(result) ? result : [])
      } else if (reportType === 'low-stock') {
        const result = await getLowStockProducts(100)
        setLowStockData(Array.isArray(result) ? result : [])
      }
      setError('')
    } catch (error) {
      setError(error.response?.data?.message || error.message || 'Failed to load report data.')
      console.error('Failed to fetch report data', error)
    } finally {
      setLoading(false)
    }
  }

  useRemoteRefresh(() => fetchReportData({ silent: salesData.length > 0 || bestSellingData.length > 0 || lowStockData.length > 0 }), 20000)

  const handleFilterChange = () => {
    if (reportType === 'sales') {
      fetchReportData()
    }
  }

  const handleExportExcel = async () => {
    let headers = []
    let data = []
    let fileName = `Report_${reportType}_${new Date().toISOString().split('T')[0]}`

    if (reportType === 'sales') {
      headers = [
        { key: 'clientId', label: 'Sale ID' },
        { key: 'dateStr', label: 'Date' },
        { key: 'customerName', label: 'Customer' },
        { key: 'total', label: 'Total (GH₵)' },
        { key: 'paymentStatus', label: 'Status' }
      ]
      data = salesData.map(s => ({
        ...s,
        dateStr: new Date(s.createdAt).toLocaleString(),
        customerName: s.customer?.name || 'Cash Sale'
      }))
    } else if (reportType === 'best-selling') {
      headers = [
        { key: 'rank', label: 'Rank' },
        { key: 'name', label: 'Product' },
        { key: 'quantity', label: 'Units Sold' },
        { key: 'revenue', label: 'Revenue (GH₵)' }
      ]
      data = bestSellingData.map((p, i) => ({ ...p, rank: i + 1 }))
    } else if (reportType === 'low-stock') {
      headers = [
        { key: 'name', label: 'Product' },
        { key: 'stock', label: 'Current Stock' },
        { key: 'categoryName', label: 'Category' }
      ]
      data = lowStockData.map(p => ({ ...p, categoryName: p.category?.name || 'N/A' }))
    }

    try {
      await exportToExcel(data, fileName, headers)
    } catch {
      alert('Excel export failed')
    }
  }

  const handleExportPDF = async () => {
    let headers = []
    let data = []
    let title = 'Report'
    let fileName = `Report_${reportType}_${new Date().toISOString().split('T')[0]}`

    if (reportType === 'sales') {
      title = 'Sales Transactions Report'
      headers = [
        { key: 'clientId', label: 'Sale ID' },
        { key: 'dateStr', label: 'Date' },
        { key: 'customerName', label: 'Customer' },
        { key: 'total', label: 'Total', formatter: (v) => Number(v).toFixed(2) },
        { key: 'paymentStatus', label: 'Status' }
      ]
      data = salesData.map(s => ({
        ...s,
        dateStr: new Date(s.createdAt).toLocaleString(),
        customerName: s.customer?.name || 'Cash Sale'
      }))
    } else if (reportType === 'best-selling') {
      title = 'Best Selling Products Report'
      headers = [
        { key: 'rank', label: 'Rank' },
        { key: 'name', label: 'Product' },
        { key: 'quantity', label: 'Units Sold' },
        { key: 'revenue', label: 'Revenue', formatter: (v) => Number(v).toFixed(2) }
      ]
      data = bestSellingData.map((p, i) => ({ ...p, rank: i + 1 }))
    } else if (reportType === 'low-stock') {
      title = 'Low Stock Alert Report'
      headers = [
        { key: 'name', label: 'Product' },
        { key: 'stock', label: 'Stock' },
        { key: 'categoryName', label: 'Category' }
      ]
      data = lowStockData.map(p => ({ ...p, categoryName: p.category?.name || 'N/A' }))
    }

    try {
      await exportToPDF(data, fileName, title, headers)
    } catch {
      alert('PDF export failed')
    }
  }

  const toReceiptSale = (sale) => ({
    ...sale,
    customerName: sale.customer?.name || sale.customerName,
    customerPhone: sale.customer?.phone || sale.customerPhone,
    cashierName: sale.cashier?.name || sale.cashierName,
    items: (sale.items || []).map((item) => ({
      ...item,
      productName: item.product?.name || item.productName || item.name,
    })),
  })

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

      <ErrorBanner message={error} onRetry={() => fetchReportData()} />

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
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPDF}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-border text-text-secondary font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              <FileText size={16} /> Export PDF
            </button>
            <button
              onClick={handleExportExcel}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-border text-text-secondary font-semibold text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              <Table size={16} /> Export Excel
            </button>
          </div>
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
                  <th className="px-4 py-3 text-right font-semibold text-text-secondary">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {salesData.length > 0 ? (
                  salesData.map((sale) => (
                    <tr key={sale.id} className="border-b border-border hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{sale.clientId}</td>
                      <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{sale.customer?.name || 'Cash Sale'}</td>
                      <td className="px-4 py-3 text-right font-semibold">GH₵ {Number(sale.total || 0).toFixed(2)}</td>
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
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReceiptSale(toReceiptSale(sale))}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-secondary transition hover:border-brand-blue hover:text-brand-blue"
                        >
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-text-secondary">
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

      {receiptSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-text-secondary">Receipt Preview</p>
                <h2 className="mt-1 text-lg font-black text-text-primary">Sale Receipt</h2>
              </div>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
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
                  srcDoc={getReceiptHtml(receiptSale)}
                  className="h-[620px] w-full border-0 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-secondary transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  printReceipt(receiptSale)
                  setReceiptSale(null)
                }}
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

