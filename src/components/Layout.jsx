import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Bell, Search, UserCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Sidebar from './Sidebar'

export default function Layout() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  return (
    <div className="min-h-screen bg-bg-canvas text-text-primary">
      <Sidebar />

      <div className="lg:ml-60 flex min-h-0 flex-col">
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
                placeholder="Search beverages, transaction ID, brand..."
                className="w-full border-0 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>

            <div className="flex items-center gap-3">
              <button className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-secondary hover:bg-brand-blue-light hover:text-brand-blue transition">
                <Bell size={18} />
              </button>
              <Link to="/settings" className="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-2 hover:shadow-sm transition">
                <UserCircle size={20} className="text-brand-blue" />
                <span className="hidden sm:inline text-sm font-semibold text-text-primary">{user?.name}</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto pt-20 pb-8 px-4 sm:px-6 lg:px-8 lg:pt-20">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
