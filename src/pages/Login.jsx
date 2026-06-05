import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { businessDetails } from '../config/business'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Unable to login. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-blue-light px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Sign in to {businessDetails.name}</h1>
        <p className="text-sm text-text-secondary mb-6">Use your cashier or admin credentials to continue.</p>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-text-secondary">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-blue"
              required
            />
          </label>
          {message && <div className="text-sm font-semibold text-danger">{message}</div>}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white hover:bg-brand-blue-dark disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
