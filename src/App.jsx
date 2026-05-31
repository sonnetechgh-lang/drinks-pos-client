import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/Home.jsx'
import LoginPage from './pages/Login.jsx'
import ProductsPage from './pages/Products.jsx'
import DashboardPage from './pages/Dashboard.jsx'
import CustomersPage from './pages/Customers.jsx'
import SettingsPage from './pages/Settings.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import { useAuth } from './hooks/useAuth'
import { useSync } from './hooks/useSync'
import './App.css'

function RootRedirect() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return user?.role === 'ADMIN' ? <Navigate to="/dashboard" replace /> : <Navigate to="/pos" replace />
}

function App() {
  useSync()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="pos" element={<HomePage />} />
          <Route path="customers" element={<CustomersPage />} />
          
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
