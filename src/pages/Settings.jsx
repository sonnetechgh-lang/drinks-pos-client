/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react'
import { defaultReceiptSettings, legacyReceiptDefaults } from '../config/business'
import { useAuth } from '../hooks/useAuth'
import { createUser, deleteUser, getUsers, updateMyProfile, updateUser } from '../api/users'
import { db } from '../db/dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { flushQueue } from '../db/syncQueue'
import { AlertCircle, CheckCircle, Edit, Plus, RefreshCw, Trash2, UserPen, X } from 'lucide-react'
import StatusPopup from '../components/StatusPopup'
import ConfirmDialog from '../components/ConfirmDialog'
import Modal from '../components/Modal'
import { Button } from '../components/ui/Button'

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
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [cashierModalOpen, setCashierModalOpen] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [businessMessage, setBusinessMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [cashierMessage, setCashierMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const isAdmin = user?.role === 'ADMIN'

  // Sync Queue Data
  const unsyncedItems = useLiveQuery(() => db.syncQueue.where('synced').equals(0).toArray()) || []
  const failedItems = unsyncedItems.filter(item => item.attempts > 0)

  const handleManualSync = async () => {
    setSyncing(true)
    try {
      await flushQueue()
      setStatusMessage({ type: 'success', text: 'Sync completed successfully.' })
    } catch (error) {
      console.error('Manual sync failed', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleClearSyncQueue = async () => {
    try {
      await db.syncQueue.where('synced').equals(0).delete()
      setStatusMessage({ type: 'success', text: 'Sync queue cleared.' })
    } catch (error) {
      console.error('Failed to clear sync queue', error)
      setStatusMessage({ type: 'error', text: 'Failed to clear sync queue.' })
    }
  }

  const handleRemoveSyncItem = async (id) => {
    try {
      await db.syncQueue.delete(id)
      setStatusMessage({ type: 'success', text: 'Sync queue item removed.' })
    } catch (error) {
      console.error('Failed to remove sync item', error)
      setStatusMessage({ type: 'error', text: 'Failed to remove sync item.' })
    }
  }

  const runConfirmAction = async () => {
    if (!confirmAction) return
    setConfirming(true)
    try {
      await confirmAction.run()
      setConfirmAction(null)
    } finally {
      setConfirming(false)
    }
  }

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

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return
    setLoadingUsers(true)
    try {
      setUsers(await getUsers())
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }, [isAdmin])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleBusinessSave = (event) => {
    event.preventDefault()
    localStorage.setItem('palace-line-settings', JSON.stringify(settings))
    setBusinessMessage('Business details saved.')
    setStatusMessage({ type: 'success', text: 'Business details saved successfully.' })
  }

  const handleAccountSave = async (event) => {
    event.preventDefault()
    setAccountMessage('')

    if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
      setAccountMessage('New passwords do not match.')
      return
    }

    const emailChanged = accountForm.email.trim().toLowerCase() !== String(user?.email || '').toLowerCase()
    const passwordChanged = Boolean(accountForm.newPassword)
    if ((emailChanged || passwordChanged) && !accountForm.currentPassword) {
      setAccountMessage('Enter your current password to change email or password.')
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
      setAccountModalOpen(false)
      setStatusMessage({ type: 'success', text: 'Login credentials updated successfully.' })
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
      setStatusMessage({ type: 'success', text: editingCashier ? 'Cashier updated successfully.' : 'Cashier added successfully.' })
      fetchUsers()
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to save cashier.')
    }
  }

  const handleRemoveCashier = async (cashier) => {
    try {
      await deleteUser(cashier.id)
      setCashierMessage('Cashier removed.')
      setStatusMessage({ type: 'success', text: 'Cashier removed successfully.' })
      fetchUsers()
    } catch (error) {
      setCashierMessage(error.response?.data?.message || 'Failed to remove cashier.')
    }
  }

  return (
    <div className="space-y-8">
      <StatusPopup message={statusMessage} onClose={() => setStatusMessage(null)} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Configuration</p>
          <h1 className="mt-3 text-3xl font-black text-text-primary">General Settings</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setAccountMessage('')
              setAccountForm({
                ...emptyAccountForm,
                name: user?.name || '',
                email: user?.email || '',
              })
              setAccountModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-primary transition hover:bg-gray-50"
          >
            <UserPen size={18} /> Update Login Credentials
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => openCashierModal()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-blue px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-blue-dark"
            >
              <Plus size={18} /> Add Cashier
            </button>
          )}
        </div>
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

        <div className="space-y-8">
          <section className="card p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Sync Health</p>
                <h2 className="mt-2 text-xl font-black text-text-primary">Local Data Status</h2>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${unsyncedItems.length > 0 ? 'bg-amber-50 text-amber-500' : 'bg-success-light text-success'}`}>
                {unsyncedItems.length > 0 ? <AlertCircle size={24} /> : <CheckCircle size={24} />}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                <span className="text-sm font-semibold text-text-secondary">Items in Queue</span>
                <span className="text-lg font-black text-text-primary">{unsyncedItems.length}</span>
              </div>

              {failedItems.length > 0 && (
                <div className="rounded-2xl border border-danger-light bg-danger-light/10 p-4">
                  <div className="flex items-center gap-2 text-danger">
                    <AlertCircle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Poison Pill Alert</span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {failedItems.length} items have failed to sync multiple times.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={syncing || unsyncedItems.length === 0}
                  onClick={handleManualSync}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-border px-4 py-3 text-xs font-bold text-text-primary hover:bg-gray-50 disabled:opacity-50 transition"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Force Sync'}
                </button>
                <button
                  type="button"
                  disabled={unsyncedItems.length === 0}
                  onClick={() => setConfirmAction({
                    title: 'Clear Sync Queue?',
                    message: 'This will remove unsynced items from this device. They will not be sent to the server.',
                    confirmLabel: 'Clear Queue',
                    run: handleClearSyncQueue,
                  })}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-danger-light/20 border border-danger-light px-4 py-3 text-xs font-bold text-danger hover:bg-danger-light/30 disabled:opacity-50 transition"
                >
                  <Trash2 size={14} /> Clear Queue
                </button>
              </div>
            </div>

            {failedItems.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Error Details</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {failedItems.slice(0, 5).map(item => (
                    <div key={item.id} className="group relative rounded-xl border border-border p-3 text-left">
                      <div className="flex items-start justify-between">
                        <div className="pr-6">
                          <p className="text-[10px] font-bold text-text-primary uppercase tracking-wider">{item.type || 'SALE'}</p>
                          <p className="mt-1 text-[10px] text-danger font-medium leading-relaxed">{item.lastError || 'Unknown error'}</p>
                        </div>
                        <button
                          onClick={() => setConfirmAction({
                            title: 'Remove Sync Item?',
                            message: 'This item will be removed from the local sync queue and will not be retried.',
                            confirmLabel: 'Remove Item',
                            run: () => handleRemoveSyncItem(item.id),
                          })}
                          className="absolute right-2 top-2 p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {failedItems.length > 5 && (
                    <p className="text-[10px] text-center text-text-muted">+{failedItems.length - 5} more errors</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="card p-8 space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Admin Account</p>
              <h2 className="mt-2 text-xl font-black text-text-primary">Login Credentials</h2>
            </div>

            <div className="rounded-3xl border border-border bg-gray-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Signed in as</p>
              <p className="mt-3 text-lg font-black text-text-primary">{user?.name}</p>
              <p className="mt-1 text-sm text-text-secondary">{user?.email}</p>
            </div>

            {accountMessage && <p className="text-sm font-semibold text-text-secondary">{accountMessage}</p>}
          </section>
        </div>
      </section>

      {isAdmin && (
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-border p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-text-secondary">Staff</p>
              <h2 className="mt-2 text-xl font-black text-text-primary">Cashier Management</h2>
            </div>
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
                            onClick={() => setConfirmAction({
                              title: 'Remove Cashier?',
                              message: `Remove ${staff.name}? This will disable their login.`,
                              confirmLabel: 'Remove Cashier',
                              run: () => handleRemoveCashier(staff),
                            })}
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

      <Modal
        open={cashierModalOpen}
        onClose={closeCashierModal}
        eyebrow="Cashier"
        title={editingCashier ? 'Edit Cashier' : 'Add Cashier'}
        size="md"
      >
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
                <Button
                  type="button"
                  onClick={closeCashierModal}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                >
                  {editingCashier ? 'Save Changes' : 'Add Cashier'}
                </Button>
              </div>
            </form>
      </Modal>

      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        eyebrow="Admin Account"
        title="Update Login Credentials"
        size="lg"
      >
            <form onSubmit={handleAccountSave} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Name</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  value={accountForm.name}
                  onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Email</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-text-primary">Current Password</label>
                <input
                  type="password"
                  className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                  value={accountForm.currentPassword}
                  onChange={(event) => setAccountForm({ ...accountForm, currentPassword: event.target.value })}
                  placeholder="Required for email or password changes"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text-primary">New Password</label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    value={accountForm.newPassword}
                    onChange={(event) => setAccountForm({ ...accountForm, newPassword: event.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text-primary">Confirm Password</label>
                  <input
                    type="password"
                    className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
                    value={accountForm.confirmPassword}
                    onChange={(event) => setAccountForm({ ...accountForm, confirmPassword: event.target.value })}
                  />
                </div>
              </div>

              {accountMessage && <p className="text-sm font-semibold text-text-secondary">{accountMessage}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
                <Button
                  type="button"
                  onClick={() => setAccountModalOpen(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                >
                  Save Login Details
                </Button>
              </div>
            </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.confirmLabel}
        tone="danger"
        loading={confirming}
      />
    </div>
  )
}
