/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Moon, Sun, UserCircle, Menu } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import Sidebar from './Sidebar'

const pageTitles = {
  '/': 'Home',
  '/pos': 'Point of Sale',
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/customers': 'Customers',
  '/reports': 'Reports',
  '/stock-audit': 'Stock Audit',
  '/settings': 'Settings',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const location = useLocation()

  const pageTitle = useMemo(() => pageTitles[location.pathname] || 'Palace Line', [location.pathname])
  const isAdmin = user?.role === 'ADMIN'

  const openSidebar = () => setMobileSidebarOpen(true)
  const closeSidebar = () => setMobileSidebarOpen(false)
  const handleLogout = () => {
    closeSidebar()
    logout()
  }

  useEffect(() => {
    closeSidebar()
  }, [location.pathname])

  const userControl = isAdmin ? (
    <Link to="/settings" className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 hover:shadow-sm transition">
      <UserCircle size={20} className="text-brand-blue" />
      <span className="hidden sm:inline text-sm font-semibold text-text-primary">{user?.name}</span>
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2">
      <UserCircle size={20} className="text-brand-blue" />
      <span className="hidden sm:inline text-sm font-semibold text-text-primary">{user?.name}</span>
    </div>
  )

  const mobileUserControl = isAdmin ? (
    <Link to="/settings" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text-primary transition hover:bg-gray-50" aria-label="Open settings">
      <UserCircle size={18} className="text-brand-blue" />
    </Link>
  ) : (
    <div className="inline-flex h-11 items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-semibold text-text-primary" aria-label="Cashier account">
      <UserCircle size={18} className="text-brand-blue" />
    </div>
  )

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary">
      <Sidebar isOpen={mobileSidebarOpen} onClose={closeSidebar} />

      <div className="lg:ml-60 flex min-h-0 flex-col">
        <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-white/95 backdrop-blur lg:hidden">
          <div className="mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <button onClick={openSidebar} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-text-secondary transition hover:bg-gray-50" aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">Welcome back</p>
              <h1 className="truncate text-lg font-black text-text-primary">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-2">
              {mobileUserControl}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-danger/20 bg-white text-danger transition hover:bg-danger-light"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <header className="fixed inset-x-0 top-0 z-20 hidden border-b border-border bg-white/95 backdrop-blur lg:left-60 lg:right-0 lg:block">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">Welcome back</p>
              <h1 className="truncate text-xl font-black text-text-primary">Hello, {user?.name || 'User'}.</h1>
            </div>

            <div className="hidden md:flex flex-1 max-w-xl items-center justify-end">
              <span className="rounded-full border border-border bg-bg-canvas px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                {pageTitle}
              </span>
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
              {userControl}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-danger/20 bg-white text-danger transition hover:bg-danger-light"
              >
                <LogOut size={18} />
              </button>
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
