import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import './App.css'

const HomePage = lazy(() => import('./pages/Home.jsx'))
const LoginPage = lazy(() => import('./pages/Login.jsx'))
const ProductsPage = lazy(() => import('./pages/Products.jsx'))
const DashboardPage = lazy(() => import('./pages/Dashboard.jsx'))
const ReportsPage = lazy(() => import('./pages/Reports.jsx'))
const CustomersPage = lazy(() => import('./pages/Customers.jsx'))
const SettingsPage = lazy(() => import('./pages/Settings.jsx'))

function RootRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return user?.role === 'ADMIN' ? <Navigate to="/dashboard" replace /> : <Navigate to="/pos" replace />
}

function PageFallback() {
  return <div className="p-8 text-center text-text-secondary">Loading...</div>
}

function App() {
  useSync()

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<RootRedirect />} />
            <Route path="pos" element={<HomePage />} />
            <Route path="customers" element={<CustomersPage />} />

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
