import { useState, useEffect } from 'react'

export default function Settings() {
  const [settings, setSettings] = useState({
    shopName: 'Palace Line Enterprise',
    address: '123 Beverage St, Accra, Ghana',
    footerText: 'Thank you for your business!',
    currency: 'GH₵',
  })

  useEffect(() => {
    const saved = localStorage.getItem('palace-line-settings') || localStorage.getItem('drinks-pos-settings')
    if (saved) setSettings(JSON.parse(saved))
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    localStorage.setItem('palace-line-settings', JSON.stringify(settings))
    alert('Settings saved successfully!')
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-text-secondary">Configuration</p>
        <h1 className="mt-3 text-3xl font-black text-text-primary">General Settings</h1>
      </div>

      <form onSubmit={handleSave} className="card p-8 space-y-6 max-w-3xl">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Shop Name</label>
          <input
            type="text"
            className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            value={settings.shopName}
            onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Address</label>
          <textarea
            className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            rows="3"
            value={settings.address}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">Receipt Footer Message</label>
          <input
            type="text"
            className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            value={settings.footerText}
            onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
          />
        </div>

        <div className="max-w-[180px]">
          <label className="block text-sm font-semibold text-text-primary mb-2">Currency Symbol</label>
          <input
            type="text"
            className="w-full rounded-3xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue-light"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-3xl bg-brand-blue px-6 py-4 text-sm font-bold text-white shadow-lg shadow-brand-blue/20 hover:bg-brand-blue-dark transition"
        >
          Save Configuration
        </button>
      </form>
    </div>
  )
}
