import axios from 'axios'

const defaultBaseUrl = 'http://localhost:4000'
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultBaseUrl,
})

let authToken = null

export const setAuthToken = (token) => {
  authToken = token
}

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${authToken}`
  }
  return config
})

export default client
