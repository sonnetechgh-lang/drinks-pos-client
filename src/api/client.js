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

export default client
