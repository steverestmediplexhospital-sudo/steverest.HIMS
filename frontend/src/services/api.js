// frontend/src/services/api.js
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})

// Attach token to every request
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem('steverest-hims-auth')
      if (stored) {
        const parsed = JSON.parse(stored)
        const token  = parsed?.state?.accessToken
        if (token) {
          config.headers['Authorization'] = 'Bearer ' + token
        }
      }
    } catch (_) {}
    return config
  },
  (error) => Promise.reject(error)
)

// Handle 401 - refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const stored = localStorage.getItem('steverest-hims-auth')
        if (stored) {
          const parsed       = JSON.parse(stored)
          const refreshToken = parsed?.state?.refreshToken
          if (refreshToken) {
            const resp            = await axios.post(BASE_URL + '/auth/refresh-token', { refreshToken })
            const { accessToken } = resp.data.data
            api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken
            original.headers['Authorization']            = 'Bearer ' + accessToken
            const updated = {
              ...parsed,
              state: { ...parsed.state, accessToken }
            }
            localStorage.setItem('steverest-hims-auth', JSON.stringify(updated))
            return api(original)
          }
        }
      } catch (_) {
        localStorage.removeItem('steverest-hims-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api