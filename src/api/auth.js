import client from './client.js'

export const loginUser = (credentials) => {
  return client.post('/v1/auth/login', credentials)
}
