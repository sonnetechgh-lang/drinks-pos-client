import { useEffect, useState } from 'react'
import { Edit, Plus, Trash2, X } from 'lucide-react'
import { defaultReceiptSettings, legacyReceiptDefaults } from '../config/business'
import { useAuth } from '../hooks/useAuth'
import { createUser, deleteUser, getUsers, updateMyProfile, updateUser } from '../api/users'

const emptyCashierForm = {
  name: '',
  email: '',
  password: '',
}

const emptyAccountForm = {
  name: '',
  email: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export default function Settings() {
  const { user, updateSession } = useAuth()
  const [settings, setSettings] = useState(defaultReceiptSettings)
  const [accountForm, setAccountForm] = useState(emptyAccountForm)
  const [users, setUsers] = useState([])
  const [cashierForm, setCashierForm] = useState(emptyCashierForm)
  const [editingCashier, setEditingCashier] = useState(null)
  const [cashierModalOpen, setCashierModalOpen] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [businessMessage, setBusinessMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [cashierMessage, setCashierMessage] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    const saved = localStorage.getItem('palace-line-settings') || localStorage.getItem('drinks-pos-settings')
    if (!saved) return

    const parsed = JSON.parse(saved)
    setSettings({
      ...defaultReceiptSettings,
      ...parsed,
      address: !parsed.address || parsed.address === legacyReceiptDefaults.address
        ? defaultReceiptSettings.address
        : parsed.address,
    })
  }, [])

  useEffect(() => {
    setAccountForm({
      ...emptyAccountForm,
      name: user?.name || '',
      email: user?.email || '',
    })
  }, [user])

  const fetchUsers = async () => {
    if (!isAdmin) return
    setLoadingUsers(true)
    try {
      setUsers(await getUsers())
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [isAdmin])

  const handleBusinessSave = (event) => {
    event.preventDefault()
    localStorage.setItem('palace-line-settings', JSON.stringify(settings))
    setBusinessMessage('Business details saved.')
  }

  const handleAccountSave = async (event) => {
    event.preventDefault()
    setAccountMessage('')

    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      setAccountMessage('New passwords do not match.')
      return
    }

    try {
      const result = await updateMyProfile({
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        currentPassword: accountForm.currentPassword,
        newPassword: accountForm.newPassword,
      })

      updateSession(result)
      setAccountForm((current) => ({
        ...current,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
      setAccountMessage('Login details updated.')
      fetchUsers()
    } catch (error) {
      setAccountMessage(error.response?.data?.message || 'Failed to update login details.')
    }
  }

  const openCashierModal = (cashier = null) => {
    setEditingCashier(cashier)
    setCashierForm(cashier
      ? { name: cashier.name, email: cashier.email, password: '' }
      : emptyCashierForm
    )
    setCashierMessage('')
    setCashierModalOpen(true)
  }

  const closeCashierModal = () => {
    setCashierModalOpen(false)
    setEditingCashier(null)
    setCashierForm(emptyCashierForm)
  }

  const handleCashierSave = async (event) => {
    event.preventDefault()
    setCashierMessage('')

    if (!editingCashier && cashierForm.password.length < 6) {
      setCashierMessage('Password must be at least 6 characters.')
      return
    }

    try {
      if (editingCashier) {
        const payload = {
          name: cashierForm.name.trim(),
          email: cashierForm.email.trim(),
        }
        if (cashierForm.password) payload.password = cashierForm.password
        await updateUser(editingCashier.id, payload)
      } else {
        await createUser({
          name: cashierForm.name.trim(),
          email: cashierForm.email.trim(),
          password: cashierForm.password,
        })
      }

      closeCashierModal()
      setCashierMessage(editingCashier ? 'Cashier updated.' : 'Cashier added.')
      fetchUsers()
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to save cashier.')
    }
  }

  const handleRemoveCashier = async (cashier) => {
    if (!window.confirm(`Remove ${cashier.name}? This will disable their login.`)) return

    try {
      await deleteUser(cashier.id)
      setCashierMessage('Cashier removed.')
      fetchUsers()
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to remove cashier.')
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Configuration</p>
        <h1 className="mt-3 text-3xl font-black text-text-primary">General Settings</h1>
      </div>

      <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleBusinessSave} className="card p-8 space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Business</p>
            <h2 className="mt-2 text-xl font-black text-text-primary">Receipt Details</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Shop Name</label>
            <input
              type="text"
              className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={settings.shopName}
              onChange={(event) => setSettings({ ...settings, shopName: event.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Address</label>
            <textarea
              className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              rows="3"
              value={settings.address}
              onChange={(event) => setSettings({ ...settings, address: event.target.value })}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Email</label>
              <input
                type="email"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={settings.email}
                onChange={(event) => setSettings({ ...settings, email: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Phone Numbers</label>
              <input
                type="text"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={settings.phone}
                onChange={(event) => setSettings({ ...settings, phone: event.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Receipt Footer Message</label>
              <input
                type="text"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={settings.footerText}
                onChange={(event) => setSettings({ ...settings, footerText: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Currency</label>
              <input
                type="text"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={settings.currency}
                onChange={(event) => setSettings({ ...settings, currency: event.target.value })}
              />
            </div>
          </div>

          {businessMessage && <p className="text-sm font-semibold text-success">{businessMessage}</p>}

          <button
            type="submit"
            className="w-full rounded-3xl bg-brand-blue px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark transition"
          >
            Save Business Details
          </button>
        </form>

        <form onSubmit={handleAccountSave} className="card p-8 space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Admin Account</p>
            <h2 className="mt-2 text-xl font-black text-text-primary">Login Credentials</h2>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Name</label>
            <input
              type="text"
              required
              className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={accountForm.name}
              onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={accountForm.email}
              onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">Current Password</label>
            <input
              type="password"
              className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
              value={accountForm.currentPassword}
              onChange={(event) => setAccountForm({ ...accountForm, currentPassword: event.target.value })}
              placeholder="Required for email or password changes"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">New Password</label>
              <input
                type="password"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={accountForm.newPassword}
                onChange={(event) => setAccountForm({ ...accountForm, newPassword: event.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Confirm Password</label>
              <input
                type="password"
                className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                value={accountForm.confirmPassword}
                onChange={(event) => setAccountForm({ ...accountForm, confirmPassword: event.target.value })}
              />
            </div>
          </div>

          {accountMessage && <p className="text-sm font-semibold text-text-secondary">{accountMessage}</p>}

          <button
            type="submit"
            className="w-full rounded-3xl bg-brand-blue px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark transition"
          >
            Update Login Details
          </button>
        </form>
      </section>

      {isAdmin && (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Staff</p>
              <h2 className="mt-2 text-xl font-black text-text-primary">Cashier Management</h2>
            </div>
            <button
              type="button"
              onClick={() => openCashierModal()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
            >
              <Plus size={18} /> Add Cashier
            </button>
          </div>

          {cashierMessage && <p className="px-6 pt-4 text-sm font-semibold text-text-secondary">{cashierMessage}</p>}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-brand-blue-light/40 text-xs uppercase tracking-[0.18em] text-text-secondary">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-t border-border">
                {loadingUsers ? (
                  <tr><td colSpan="5" className="px-6 py-6 text-center text-text-secondary">Loading users...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-6 text-center text-text-secondary">No users found.</td></tr>
                ) : users.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-semibold text-text-primary">{staff.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{staff.email}</td>
                    <td className="px-6 py-4 text-text-secondary">{staff.role}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${staff.active ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
                        {staff.active ? 'Active' : 'Removed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {staff.role === 'CASHIER' && (
                          <button
                            type="button"
                            onClick={() => openCashierModal(staff)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-gray-100"
                            aria-label={`Edit ${staff.name}`}
                          >
                            <Edit size={17} />
                          </button>
                        )}
                        {staff.role === 'CASHIER' && staff.active && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCashier(staff)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-danger transition hover:bg-danger-light"
                            aria-label={`Remove ${staff.name}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {cashierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Cashier</p>
                <h2 className="mt-2 text-2xl font-black text-text-primary">{editingCashier ? 'Edit Cashier' : 'Add Cashier'}</h2>
              </div>
              <button
                type="button"
                onClick={closeCashierModal}
                className="rounded-full p-2 text-text-muted transition hover:bg-gray-100"
                aria-label="Close cashier form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCashierSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Name</label>
                <input
                  required
                  value={cashierForm.name}
                  onChange={(event) => setCashierForm({ ...cashierForm, name: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Email</label>
                <input
                  type="email"
                  required
                  value={cashierForm.email}
                  onChange={(event) => setCashierForm({ ...cashierForm, email: event.target.value })}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">
                  {editingCashier ? 'New Password' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingCashier}
                  value={cashierForm.password}
                  onChange={(event) => setCashierForm({ ...cashierForm, password: event.target.value })}
                  placeholder={editingCashier ? 'Leave blank to keep current password' : ''}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                />
              </div>

              {cashierMessage && <p className="text-sm font-semibold text-text-secondary">{cashierMessage}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
                <button
                  type="button"
                  onClick={closeCashierModal}
                  className="rounded-2xl px-5 py-3 text-sm font-bold text-text-secondary transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
                >
                  {editingCashier ? 'Save Changes' : 'Add Cashier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
