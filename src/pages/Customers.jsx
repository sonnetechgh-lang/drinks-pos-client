import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { getCustomers, createCustomer, updateCustomer } from '../api/customers'
import { addCustomerPaymentToQueue } from '../db/syncQueue'
import { useAuth } from '../hooks/useAuth'

export default function CustomersPage() {
  const { user } = useAuth()
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
  const [saving, setSaving] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const loadCustomers = async (query = '') => {
    setLoading(true)
    try {
      const data = await getCustomers(query)
      setCustomers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const handleSearch = async (value) => {
    setSearch(value)
    loadCustomers(value)
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const newCustomer = await createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        creditLimit: Number(creditLimit) || 0,
      })
      setCustomers((prev) => [newCustomer, ...prev])
      setName('')
      setPhone('')
      setNotes('')
      setCreditLimit('')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handlePayment = async (event) => {
    event.preventDefault()
    if (!paymentCustomerId || Number(paymentAmount) <= 0) return
    if (paymentMethod === 'MOMO' && !momoReference.trim()) {
      alert('Enter the MoMo reference.')
      return
    }

    setSavingPayment(true)
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
    } catch (err) {
      alert('Failed to record payment')
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
    try {
      const updated = await updateCustomer(editingCustomer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        creditLimit: Number(editCreditLimit) || 0,
      })
      setCustomers((prev) => prev.map((customer) => (customer.id === updated.id ? { ...customer, ...updated } : customer)))
      setEditingCustomer(null)
    } catch (err) {
      console.error(err)
      alert('Failed to update customer')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleActive = async (customer) => {
    try {
      const updated = await updateCustomer(customer.id, { active: !customer.active })
      setCustomers((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
    } catch (err) {
      console.error(err)
      alert('Failed to update status')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Accounts</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">Customers</h1>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="space-y-6">
          <div className="card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Saved customers</p>
                <h2 className="mt-2 text-xl font-black text-text-primary">Customer list</h2>
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

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-brand-blue-light/40 text-xs uppercase tracking-[0.18em] text-text-secondary">
                  <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Contact</th>
                    <th className="px-6 py-4">Credit Limit</th>
                    <th className="px-6 py-4">Balance</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Actions</th>
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
                    customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-text-primary">{customer.name}</div>
                          <div className="mt-2 text-xs text-text-secondary">{customer.clientId ? customer.clientId : `CUST-${customer.id.slice(0, 8).toUpperCase()}`}</div>
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          <div>{customer.phone || '-'}</div>
                          {customer.notes && <div className="mt-1 text-xs text-text-secondary">{customer.notes}</div>}
                        </td>
                        <td className="px-6 py-4 text-text-primary">GH₵ {Number(customer.creditLimit || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-text-primary">GH₵ {Number(customer.balance || 0).toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${customer.active ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                            {customer.active ? 'Active' : 'Blocked'}
                          </span>
                        </td>
                        <td className="px-6 py-4 space-x-2">
                          <button
                            type="button"
                            onClick={() => handleEditClick(customer)}
                            className="rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditClick(customer)}
                            className="rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-gray-50"
                          >
                            Limit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(customer)}
                            className="rounded-full border border-border bg-white px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-gray-50"
                          >
                            {customer.active ? 'Block' : 'Unblock'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Add New Customer</p>
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  placeholder="Customer name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  placeholder="Optional phone"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Credit limit</label>
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
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  placeholder="Optional notes"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
              >
                <Plus size={16} /> Add Customer
              </button>
            </form>
          </div>

          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Advance payment</p>
            <form onSubmit={handlePayment} className="mt-4 space-y-4">
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
              <button
                type="submit"
                disabled={savingPayment}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
              >
                Record Payment
              </button>
            </form>
          </div>

          {editingCustomer && (
            <div className="card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Edit customer</p>
                  <h2 className="mt-2 text-xl font-black text-text-primary">{editingCustomer.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
                  <input
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
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-blue-dark disabled:opacity-60"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
