import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  LogOut,
  X,
  BarChart3,
} from 'lucide-react'
import { businessDetails } from '../config/business'

const navSections = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN'] },
      { name: 'Reports', path: '/reports', icon: <BarChart3 size={20} />, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Sales',
    items: [
      { name: 'POS / Checkout', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['ADMIN', 'CASHIER'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { name: 'Products', path: '/products', icon: <Package size={20} />, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { name: 'Customers', path: '/customers', icon: <Package size={20} />, roles: ['ADMIN', 'CASHIER'] },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'Settings', path: '/settings', icon: <Settings size={20} />, roles: ['ADMIN'] },
    ],
  },
]

export default function Sidebar({ isOpen, toggleSidebar }) {
  const { user, logout } = useAuth()
  const roleBadge = user?.role === 'ADMIN'
    ? 'bg-brand-blue-light text-brand-blue'
    : 'bg-warning-light text-warning'

  const filteredSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(user?.role)),
  })).filter((section) => section.items.length > 0)

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={toggleSidebar} />
      )}

      <aside className={`fixed inset-x-0 top-16 bottom-0 z-50 w-72 transform border-r border-border bg-white transition-transform duration-300 lg:fixed lg:inset-y-0 lg:top-0 lg:left-0 lg:translate-x-0 lg:w-60 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden lg:flex lg:flex-col lg:h-full">
          <div className="px-6 py-7 border-b">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-secondary">Palace Line</p>
            <h2 className="mt-3 text-3xl font-black text-text-primary">{businessDetails.name.replace('Palace Line ', '')}</h2>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{businessDetails.location}</p>
          </div>

          <div className="px-6 py-6 space-y-6">
            {filteredSections.map((section) => (
              <div key={section.label}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">{section.label}</p>
                <nav className="space-y-2">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={toggleSidebar}
                      className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-blue-light text-brand-blue shadow-sm border-l-4 border-brand-blue' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'}`}
                    >
                      {item.icon}
                      {item.name}
                    </NavLink>
                  ))}
                </nav>
              </div>
            ))}
          </div>

          <div className="mt-auto px-6 py-6 border-t bg-bg-canvas">
            <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-white text-lg font-black">
                  {user?.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{user?.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-text-secondary">Account</p>
                </div>
              </div>
              <div className={`mt-4 inline-flex items-center rounded-full px-3 py-2 text-xs font-semibold ${roleBadge}`}> {user?.role === 'ADMIN' ? 'Admin' : 'Cashier'} </div>
              <button
                onClick={logout}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-danger ring-1 ring-danger-light hover:bg-danger-light transition"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>

        <div className="lg:hidden px-4 pt-6 pb-6">
          <nav className="space-y-2">
            {filteredSections.flatMap((section) => section.items).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={toggleSidebar}
                className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-blue-light text-brand-blue' : 'text-text-secondary hover:bg-gray-50 hover:text-text-primary'}`}
              >
                {item.icon}
                {item.name}
              </NavLink>
            ))}
          </nav>
          <div className="mt-6 rounded-3xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-white text-lg font-black">
                {user?.name?.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary truncate">{user?.name}</p>
                <p className="text-xs uppercase tracking-[0.24em] text-text-secondary">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-danger ring-1 ring-danger-light hover:bg-danger-light transition"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
