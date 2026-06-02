import { useState, useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Moon, Search, Sun, UserCircle, Menu } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import Sidebar from './Sidebar'

const pageTitles = {
  '/': 'Home',
  '/pos': 'Point of Sale',
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/customers': 'Customers',
  '/settings': 'Settings',
}

export default function Layout() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  const pageTitle = useMemo(() => pageTitles[location.pathname] || 'Palace Line', [location.pathname])

  const toggleSidebar = () => setMobileSidebarOpen((open) => !open)

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary">
      <Sidebar isOpen={mobileSidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="lg:ml-60 flex min-h-0 flex-col">
        <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <button onClick={toggleSidebar} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-text-secondary transition hover:bg-gray-50">
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">Welcome back</p>
              <h1 className="truncate text-lg font-black text-text-primary">{pageTitle}</h1>
            </div>
            <Link to="/settings" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-gray-50">
              <UserCircle size={18} className="text-brand-blue" />
            </Link>
          </div>
        </header>

        <header className="fixed inset-x-0 top-0 z-20 hidden border-b border-border bg-white/95 backdrop-blur lg:left-60 lg:right-0 lg:block">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">Welcome back</p>
              <h1 className="truncate text-xl font-black text-text-primary">Hello, {user?.name || 'User'}.</h1>
            </div>

            <div className="hidden md:flex flex-1 max-w-xl items-center gap-3 rounded-full border border-border bg-white px-3 py-2 shadow-sm">
              <Search size={18} className="text-text-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products, transaction ID, brand..."
                className="w-full border-0 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'day' : 'night'} theme`}
                title={`Switch to ${theme === 'dark' ? 'day' : 'night'} theme`}
                className={`hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition ${theme === 'dark' ? 'border-border bg-bg-card text-warning hover:bg-brand-blue-light' : 'border-border bg-white text-text-secondary hover:bg-brand-blue-light hover:text-brand-blue'}`}
              >
                {theme === 'dark' ? <Sun size={18} className="text-current" /> : <Moon size={18} className="text-current" />}
              </button>
              <Link to="/settings" className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 hover:shadow-sm transition">
                <UserCircle size={20} className="text-brand-blue" />
                <span className="hidden sm:inline text-sm font-semibold text-text-primary">{user?.name}</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pt-24 pb-8 px-4 sm:px-6 lg:px-8 lg:pt-20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
