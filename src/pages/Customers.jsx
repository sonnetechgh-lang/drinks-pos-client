import { useState } from 'react'
import { Banknote, Ban, Pencil, Plus, Search, UserCheck } from 'lucide-react'
import { getCustomers, createCustomer, updateCustomer } from '../api/customers'
import { addCustomerPaymentToQueue, addCustomerToQueue } from '../db/syncQueue'
import { db } from '../db/dexie'
import { useAuth } from '../hooks/useAuth'
import { useRemoteRefresh } from '../hooks/useRemoteRefresh'
import ErrorBanner from '../components/ErrorBanner'
import StatusPopup from '../components/StatusPopup'
import Modal from '../components/Modal'
import { Button } from '../components/ui/Button'
import { formatCurrency } from '../utils/currency'

export default function CustomersPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [paymentCustomerId, setPaymentCustomerId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [momoReference, setMomoReference] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editCreditLimit, setEditCreditLimit] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [statusMessage, setStatusMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)

  const loadCustomers = async (query = '', { silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const data = await getCustomers(query)
      setCustomers(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load customers.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useRemoteRefresh(() => loadCustomers(search, { silent: customers.length > 0 }))

  const handleSearch = async (value) => {
    setSearch(value)
    loadCustomers(value)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!name.trim()) return

    const online = typeof navigator !== 'undefined' ? navigator.onLine : true
    setSaving(true)
    setFormError('')
    setStatusMessage(null)
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        creditLimit: isAdmin ? (Number(creditLimit) || 0) : 0,
      }

      const newCustomer = online ? await createCustomer(payload) : await addCustomerToQueue(payload)
      await db.customers.put({ ...newCustomer, synced: online ? 1 : 0 })
      
      setCustomers((prev) => [newCustomer, ...prev])
      setName('')
      setPhone('')
      setNotes('')
      setCreditLimit('')
      setShowCreateModal(false)
      setStatusMessage({ 
        type: online ? 'success' : 'warning', 
        text: online 
          ? `Customer ${newCustomer.name} added successfully.` 
          : `Customer ${newCustomer.name} saved locally (offline).` 
      })
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to create customer.'
      setFormError(message)
      setStatusMessage({ type: 'error', text: message })
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (event) => {
    event.preventDefault()
    if (!paymentCustomerId || Number(paymentAmount) <= 0) return
    if (paymentMethod === 'MOMO' && !momoReference.trim()) {
      setStatusMessage({ type: 'error', text: 'Enter the MoMo reference.' })
      return
    }

    setSavingPayment(true)
    setStatusMessage(null)
    try {
      await addCustomerPaymentToQueue({
        customerId: paymentCustomerId,
        amount: Number(paymentAmount),
        method: paymentMethod,
        momoReference: paymentMethod === 'MOMO' ? momoReference.trim() : undefined,
        note: paymentNote.trim() || undefined,
        cashierId: user.id,
      })
      setPaymentCustomerId('')
      setPaymentAmount('')
      setPaymentMethod('CASH')
      setMomoReference('')
      setPaymentNote('')
      setShowPaymentModal(false)
      setStatusMessage({ type: 'success', text: 'Customer payment recorded successfully.' })
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to record payment.' })
    } finally {
      setSavingPayment(false)
    }
  }

  const handleEditClick = (customer) => {
    setEditingCustomer(customer)
    setEditName(customer.name)
    setEditPhone(customer.phone || '')
    setEditCreditLimit(customer.creditLimit != null ? String(customer.creditLimit) : '')
  }

  const handleSaveEdit = async () => {
    if (!editingCustomer || !editName.trim()) return
    setSavingEdit(true)
    setStatusMessage(null)
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim(),
      }
      if (isAdmin) {
        payload.creditLimit = Number(editCreditLimit) || 0
      }

      const updated = await updateCustomer(editingCustomer.id, payload)
      setCustomers((prev) => prev.map((customer) => (customer.id === updated.id ? { ...customer, ...updated } : customer)))
      setEditingCustomer(null)
      setStatusMessage({ type: 'success', text: `Customer ${updated.name} updated successfully.` })
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to update customer.' })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleActive = async (customer) => {
    try {
      const updated = await updateCustomer(customer.id, { active: !customer.active })
      setCustomers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
      setStatusMessage({ type: 'success', text: `${updated.name} is now ${updated.active ? 'active' : 'blocked'}.` })
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to update status.' })
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Accounts</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Customers</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary shadow-sm transition hover:bg-gray-50"
          >
            <Banknote size={18} /> Add Advance Payment
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 transition hover:bg-brand-blue-dark"
          >
            <Plus size={18} /> Add New Customer
          </button>
        </div>
      </div>

      <StatusPopup message={statusMessage} onClose={() => setStatusMessage(null)} />

      <div className="grid gap-6">
        <section className="space-y-6">
          <ErrorBanner message={error} onRetry={() => loadCustomers(search)} />

          <div className="card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Saved customers</p>
                <h2 className="mt-2 text-xl font-black text-text-primary">{customers.length} customers</h2>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
                <input
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search customer name or phone"
                  className="w-full rounded-3xl border border-border bg-white py-3 pl-11 pr-4 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full table-fixed text-left">
                <thead className="bg-slate-50 text-xs uppercase text-text-secondary">
                  <tr>
                    <th className="w-[24%] px-5 py-3">Customer</th>
                    <th className="w-[18%] px-5 py-3">Contact</th>
                    <th className="w-[13%] px-5 py-3 text-right">Credit Limit</th>
                    <th className="w-[15%] px-5 py-3 text-right">Amt Owed</th>
                    <th className="w-[15%] px-5 py-3 text-right">Wallet</th>
                    <th className="w-[15%] px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-t border-border">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-6 text-center text-text-secondary">Loading customers...</td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-6 text-center text-text-secondary">No customers recorded yet.</td>
                    </tr>
                  ) : (
                    customers.map((customer) => {
                      const balance = Number(customer.balance || 0)
                      const amtOwed = balance < 0 ? Math.abs(balance) : 0
                      const wallet = balance > 0 ? balance : 0
                      
                      return (
                        <tr key={customer.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="truncate font-semibold text-text-primary">{customer.name}</div>
                            <div className="mt-1 truncate text-xs text-text-secondary">{customer.clientId ? customer.clientId : `CUST-${customer.id.slice(0, 8).toUpperCase()}`}</div>
                          </td>
                          <td className="px-5 py-4 text-sm text-text-secondary">
                            <div className="truncate">{customer.phone || '-'}</div>
                            {customer.notes && <div className="mt-1 truncate text-xs text-text-secondary">{customer.notes}</div>}
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-text-primary">{formatCurrency(customer.creditLimit)}</td>
                          <td className={`px-5 py-4 text-right font-black ${amtOwed > 0 ? 'text-danger' : 'text-slate-300'}`}>
                            {amtOwed > 0 ? formatCurrency(amtOwed) : formatCurrency(0)}
                          </td>
                          <td className={`px-5 py-4 text-right font-black ${wallet > 0 ? 'text-success' : 'text-slate-300'}`}>
                            {wallet > 0 ? formatCurrency(wallet) : formatCurrency(0)}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditClick(customer)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-text-secondary transition hover:border-brand-blue hover:text-brand-blue"
                              title="Edit customer"
                              aria-label={`Edit ${customer.name}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(customer)}
                              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                                customer.active
                                  ? 'border-danger/20 bg-danger-light/30 text-danger hover:bg-danger-light'
                                  : 'border-success/20 bg-success-light/40 text-success hover:bg-success-light'
                              }`}
                              title={customer.active ? 'Block customer' : 'Unblock customer'}
                              aria-label={`${customer.active ? 'Block' : 'Unblock'} ${customer.name}`}
                            >
                              {customer.active ? <Ban size={15} /> : <UserCheck size={15} />}
                            </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4 sm:hidden px-4 py-4">
              {loading ? (
                <div className="rounded-3xl border border-border bg-gray-50 p-6 text-center text-text-secondary">Loading customers...</div>
              ) : customers.length === 0 ? (
                <div className="rounded-3xl border border-border bg-gray-50 p-6 text-center text-text-secondary">No customers recorded yet.</div>
              ) : (
                customers.map((customer) => {
                  const balance = Number(customer.balance || 0)
                  const amtOwed = balance < 0 ? Math.abs(balance) : 0
                  const wallet = balance > 0 ? balance : 0

                  return (
                    <div key={customer.id} className="rounded-3xl border border-border bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-text-primary">{customer.name}</p>
                          <p className="mt-1 text-xs text-text-secondary">{customer.clientId ? customer.clientId : `CUST-${customer.id.slice(0, 8).toUpperCase()}`}</p>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${customer.active ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                          {customer.active ? 'Active' : 'Blocked'}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-text-secondary">
                        <div className="flex justify-between items-center border-b border-border pb-2">
                          <p className="font-semibold text-text-primary">Phone</p>
                          <p>{customer.phone || '-'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-1">
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">Amt Owed</p>
                            <p className={`mt-2 font-black ${amtOwed > 0 ? 'text-danger' : 'text-slate-400'}`}>{formatCurrency(amtOwed)}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">Wallet</p>
                            <p className={`mt-2 font-black ${wallet > 0 ? 'text-success' : 'text-slate-400'}`}>{formatCurrency(wallet)}</p>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border p-3 flex justify-between items-center bg-slate-50">
                           <p className="text-[10px] uppercase tracking-[0.18em] text-text-secondary">Credit Limit</p>
                           <p className="font-bold text-text-primary">{formatCurrency(customer.creditLimit)}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditClick(customer)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-gray-50"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(customer)}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold transition ${
                            customer.active
                              ? 'bg-danger-light text-danger hover:bg-danger-light/80'
                              : 'bg-success-light text-success hover:bg-success-light/80'
                          }`}
                        >
                          {customer.active ? <Ban size={14} /> : <UserCheck size={14} />}
                          {customer.active ? 'Block' : 'Unblock'}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </section>

      </div>

      <Modal
        open={Boolean(editingCustomer)}
        onClose={() => setEditingCustomer(null)}
        eyebrow="Customers"
        title="Edit Customer"
        size="md"
        closeDisabled={savingEdit}
      >
        <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
              <input
                data-autofocus="true"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Phone</label>
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Credit limit</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editCreditLimit}
                  onChange={(e) => setEditCreditLimit(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <Button type="button" variant="secondary" onClick={() => setEditingCustomer(null)} disabled={savingEdit}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveEdit} loading={savingEdit}>
                Save Changes
              </Button>
            </div>
          </div>
      </Modal>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        eyebrow="Customers"
        title="Add New Customer"
        size="lg"
        closeDisabled={saving}
      >
        <form onSubmit={handleCreate} className="space-y-4">
            {formError && (
              <div className="rounded-2xl border border-danger/20 bg-danger-light/30 p-3 text-sm font-semibold text-danger">
                {formError}
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary">Name</label>
              <input
                data-autofocus="true"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                placeholder="Customer name"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                placeholder="Optional phone"
              />
            </div>
            {isAdmin && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Credit limit</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  placeholder="0.00"
                />
              </div>
            )}
            <div>
              <label className="mb-2 block text-sm font-semibold text-text-primary">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                placeholder="Optional notes"
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                <Plus size={16} /> Add Customer
              </Button>
            </div>
          </form>
      </Modal>

      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        eyebrow="Customers"
        title="Add Advance Payment"
        size="md"
        closeDisabled={savingPayment}
      >
        <form onSubmit={handlePayment} className="space-y-4">
            <select
              value={paymentCustomerId}
              onChange={(e) => setPaymentCustomerId(e.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              required
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Amount"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              required
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            >
              <option value="CASH">Cash</option>
              <option value="MOMO">MoMo</option>
            </select>
            {paymentMethod === 'MOMO' && (
              <input
                value={momoReference}
                onChange={(e) => setMomoReference(e.target.value)}
                placeholder="MoMo reference"
                className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              />
            )}
            <input
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Note (optional)"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            />
            <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
              <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)} disabled={savingPayment}>
                Cancel
              </Button>
              <Button type="submit" loading={savingPayment}>
                Record Payment
              </Button>
            </div>
          </form>
      </Modal>
    </div>
  )
}
