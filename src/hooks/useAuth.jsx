import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { loginUser } from '../api/auth.js'
import { setAuthToken } from '../api/client.js'

const AUTH_TOKEN_KEY = 'palace-line-auth-token'
const AUTH_USER_KEY = 'palace-line-user'
const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY)
  })
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(AUTH_USER_KEY)
    return storedUser ? JSON.parse(storedUser) : null
  })
  const [error, setError] = useState(null)

  useEffect(() => {
    setAuthToken(token)
  }, [token])

  const login = async ({ email, password }) => {
    setError(null)
    try {
      const response = await loginUser({ email, password })
      const { token: authToken, user: authUser } = response.data.data
      localStorage.setItem(AUTH_TOKEN_KEY, authToken)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authUser))
      setToken(authToken)
      setUser(authUser)
      return authUser
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
      throw err
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    setAuthToken(null)
  }

  const updateSession = ({ token: nextToken, user: nextUser }) => {
    if (nextToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
      setToken(nextToken)
    }

    if (nextUser) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
    }
  }

  const value = useMemo(
    () => ({
      token,
      user,
      error,
      login,
      logout,
      updateSession,
      isAuthenticated: Boolean(token),
    }),
    [token, user, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
