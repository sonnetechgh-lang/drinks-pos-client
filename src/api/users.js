import client from './client.js'

export const getUsers = async () => {
  const response = await client.get('/v1/users')
  return response.data.data
}

export const getCurrentUser = async () => {
  const response = await client.get('/v1/users/me')
  return response.data.data.user
}

export const createUser = async (payload) => {
  const response = await client.post('/v1/users', payload)
  return response.data.data
}

export const updateUser = async (id, payload) => {
  const response = await client.patch(`/v1/users/${id}`, payload)
  return response.data.data
}

export const deleteUser = async (id) => {
  const response = await client.delete(`/v1/users/${id}`)
  return response.data.data
}

export const updateMyProfile = async (payload) => {
  const response = await client.patch('/v1/users/me', payload)
  return response.data.data
}
