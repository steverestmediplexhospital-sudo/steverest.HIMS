// frontend/write-files.js
const fs   = require('fs')
const path = require('path')

fs.mkdirSync('src/store',    { recursive: true })
fs.mkdirSync('src/services', { recursive: true })

// ─── authStore.js ─────────────────────────────────────────────────────────────
fs.writeFileSync('src/store/authStore.js', [
  "import { create } from 'zustand'",
  "import { persist, createJSONStorage } from 'zustand/middleware'",
  "import api from '../services/api'",
  "",
  "const useAuthStore = create(",
  "  persist(",
  "    (set, get) => ({",
  "      user: null,",
  "      accessToken: null,",
  "      refreshToken: null,",
  "      isLoading: false,",
  "      error: null,",
  "      isAuthenticated: false,",
  "",
  "      login: async (email, password) => {",
  "        set({ isLoading: true, error: null })",
  "        try {",
  "          const response = await api.post('/auth/login', {",
  "            email: email.trim().toLowerCase(),",
  "            password",
  "          })",
  "          const { user, accessToken, refreshToken } = response.data.data",
  "          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken",
  "          set({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false, error: null })",
  "          return { success: true, user }",
  "        } catch (error) {",
  "          const message = error.response?.data?.message || 'Login failed'",
  "          set({ isLoading: false, error: message, isAuthenticated: false, user: null, accessToken: null })",
  "          return { success: false, message }",
  "        }",
  "      },",
  "",
  "      logout: async () => {",
  "        try {",
  "          const { accessToken } = get()",
  "          if (accessToken) await api.post('/auth/logout').catch(() => {})",
  "        } catch (_) {}",
  "        delete api.defaults.headers.common['Authorization']",
  "        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, error: null, isLoading: false })",
  "      },",
  "",
  "      refreshAccessToken: async () => {",
  "        const { refreshToken } = get()",
  "        if (!refreshToken) { get().logout(); return false }",
  "        try {",
  "          const response = await api.post('/auth/refresh-token', { refreshToken })",
  "          const { accessToken, refreshToken: newRefresh, user } = response.data.data",
  "          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken",
  "          set({ accessToken, refreshToken: newRefresh || refreshToken, user: user || get().user })",
  "          return true",
  "        } catch (_) {",
  "          get().logout()",
  "          return false",
  "        }",
  "      },",
  "",
  "      getProfile: async () => {",
  "        try {",
  "          const response = await api.get('/auth/profile')",
  "          const user = response.data.data?.user",
  "          if (user) set({ user })",
  "          return user",
  "        } catch (_) { return null }",
  "      },",
  "",
  "      initialize: () => {",
  "        const { accessToken, isAuthenticated } = get()",
  "        if (accessToken && isAuthenticated) {",
  "          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken",
  "        }",
  "      },",
  "",
  "      clearError: () => set({ error: null }),",
  "      updateUser: (userData) => set({ user: { ...get().user, ...userData } })",
  "    }),",
  "    {",
  "      name: 'steverest-hims-auth',",
  "      storage: createJSONStorage(() => localStorage),",
  "      partialize: (state) => ({",
  "        user:            state.user,",
  "        accessToken:     state.accessToken,",
  "        refreshToken:    state.refreshToken,",
  "        isAuthenticated: state.isAuthenticated",
  "      })",
  "    }",
  "  )",
  ")",
  "",
  "export default useAuthStore"
].join('\n'), 'utf8')

console.log('✅ authStore.js written - ' + fs.statSync('src/store/authStore.js').size + ' bytes')

// ─── api.js ───────────────────────────────────────────────────────────────────
fs.writeFileSync('src/services/api.js', [
  "import axios from 'axios'",
  "",
  "const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'",
  "",
  "const api = axios.create({",
  "  baseURL: BASE_URL,",
  "  timeout: 30000,",
  "  headers: { 'Content-Type': 'application/json' }",
  "})",
  "",
  "api.interceptors.request.use(",
  "  (config) => {",
  "    try {",
  "      const stored = localStorage.getItem('steverest-hims-auth')",
  "      if (stored) {",
  "        const parsed = JSON.parse(stored)",
  "        const token  = parsed?.state?.accessToken",
  "        if (token) config.headers['Authorization'] = 'Bearer ' + token",
  "      }",
  "    } catch (_) {}",
  "    return config",
  "  },",
  "  (error) => Promise.reject(error)",
  ")",
  "",
  "api.interceptors.response.use(",
  "  (response) => response,",
  "  async (error) => {",
  "    const original = error.config",
  "    if (error.response?.status === 401 && !original._retry) {",
  "      original._retry = true",
  "      try {",
  "        const stored = localStorage.getItem('steverest-hims-auth')",
  "        if (stored) {",
  "          const parsed       = JSON.parse(stored)",
  "          const refreshToken = parsed?.state?.refreshToken",
  "          if (refreshToken) {",
  "            const resp        = await axios.post(BASE_URL + '/auth/refresh-token', { refreshToken })",
  "            const { accessToken } = resp.data.data",
  "            api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken",
  "            original.headers['Authorization']            = 'Bearer ' + accessToken",
  "            const updated = { ...parsed, state: { ...parsed.state, accessToken } }",
  "            localStorage.setItem('steverest-hims-auth', JSON.stringify(updated))",
  "            return api(original)",
  "          }",
  "        }",
  "      } catch (_) {",
  "        localStorage.removeItem('steverest-hims-auth')",
  "        window.location.href = '/login'",
  "      }",
  "    }",
  "    return Promise.reject(error)",
  "  }",
  ")",
  "",
  "export default api"
].join('\n'), 'utf8')

console.log('✅ api.js written      - ' + fs.statSync('src/services/api.js').size + ' bytes')

// ─── .env ─────────────────────────────────────────────────────────────────────
fs.writeFileSync('.env', [
  "VITE_API_URL=http://localhost:5000/api",
  "VITE_SOCKET_URL=http://localhost:5000",
  "VITE_APP_NAME=St. Everest Mediplex HIMS",
  "VITE_APP_VERSION=2.0.0"
].join('\n'), 'utf8')

console.log('✅ .env written')

// ─── Verify ───────────────────────────────────────────────────────────────────
console.log('\n📋 File sizes:')
console.log('  authStore.js : ' + fs.statSync('src/store/authStore.js').size   + ' bytes')
console.log('  api.js       : ' + fs.statSync('src/services/api.js').size      + ' bytes')
console.log('  .env         : ' + fs.statSync('.env').size                      + ' bytes')

// Spot check
const storeContent = fs.readFileSync('src/store/authStore.js', 'utf8')
const apiContent   = fs.readFileSync('src/services/api.js',    'utf8')

console.log('\n🔍 Spot checks:')
console.log('  authStore has export:    ', storeContent.includes('export default useAuthStore'))
console.log('  authStore has login fn:  ', storeContent.includes('login: async'))
console.log('  authStore has logout fn: ', storeContent.includes('logout: async'))
console.log('  api.js has interceptors: ', apiContent.includes('interceptors'))
console.log('  api.js has export:       ', apiContent.includes('export default api'))

console.log('\n🚀 Done! Now run: npm run dev')