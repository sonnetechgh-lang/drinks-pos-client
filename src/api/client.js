import axios from 'axios'

const AUTH_TOKEN_KEY = 'palace-line-auth-token'
const defaultBaseUrl = 'http://localhost:4000'
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
})

let authToken = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null

export const setAuthToken = (token) => {
  authToken = token
}

client.interceptors.request.use((config) => {
  if (!authToken && typeof localStorage !== 'undefined') {
    authToken = localStorage.getItem(AUTH_TOKEN_KEY)
  }

  if (authToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || ''
    if (error.response?.status === 401 && /disabled|invalid token|unauthorized/i.test(message)) {
      authToken = null
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTH_TOKEN_KEY)
        localStorage.removeItem('palace-line-user')
      }
    }
    return Promise.reject(error)
  }
)

export default client
