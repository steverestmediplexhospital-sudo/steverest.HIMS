// frontend/fix-all.js
const fs = require('fs')
const path = require('path')

console.log('🔧 Fixing all import issues...\n')

// ─── 1. Create auth.store.js (the missing file App.jsx needs) ─────────────────
const authStorePath = path.join('src', 'store', 'auth.store.js')
fs.mkdirSync(path.join('src', 'store'), { recursive: true })
fs.writeFileSync(authStorePath, [
  "// frontend/src/store/auth.store.js",
  "// Single source of truth - all components import from here",
  "import { create } from 'zustand'",
  "import { persist, createJSONStorage } from 'zustand/middleware'",
  "import api from '../services/api'",
  "",
  "const useAuthStore = create(",
  "  persist(",
  "    (set, get) => ({",
  "      user:            null,",
  "      accessToken:     null,",
  "      refreshToken:    null,",
  "      isLoading:       false,",
  "      error:           null,",
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
  "          const message = error.response?.data?.message || 'Login failed. Check credentials.'",
  "          set({ isLoading: false, error: message, isAuthenticated: false, user: null, accessToken: null, refreshToken: null })",
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
  "        } catch (_) { get().logout(); return false }",
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
  "      clearError:  () => set({ error: null }),",
  "      updateUser:  (data) => set({ user: { ...get().user, ...data } }),",
  "      isAdmin:     () => ['SUPER_ADMIN','HOSPITAL_ADMIN','MEDICAL_DIRECTOR'].includes(get().user?.role),",
  "      hasRole:     (...roles) => roles.includes(get().user?.role),",
  "      getFullName: () => get().user ? get().user.firstName + ' ' + get().user.lastName : '',",
  "      getInitials: () => get().user ? (get().user.firstName?.[0]||'')+(get().user.lastName?.[0]||'') : 'U'",
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
  "export { useAuthStore }",
  "export default useAuthStore"
].join('\n'), 'utf8')
console.log('✅ Created: src/store/auth.store.js (' + fs.statSync(authStorePath).size + ' bytes)')

// ─── 2. Make authStore.js re-export from auth.store.js ────────────────────────
const authStoreJsPath = path.join('src', 'store', 'authStore.js')
fs.writeFileSync(authStoreJsPath, [
  "// frontend/src/store/authStore.js",
  "// Re-exports from auth.store.js for compatibility",
  "export { default, useAuthStore } from './auth.store'"
].join('\n'), 'utf8')
console.log('✅ Updated: src/store/authStore.js  (re-export only)')

// ─── 3. Create api.js ─────────────────────────────────────────────────────────
fs.mkdirSync(path.join('src', 'services'), { recursive: true })
const apiPath = path.join('src', 'services', 'api.js')
fs.writeFileSync(apiPath, [
  "// frontend/src/services/api.js",
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
  "          const parsed = JSON.parse(stored)",
  "          const refreshToken = parsed?.state?.refreshToken",
  "          if (refreshToken) {",
  "            const resp = await axios.post(BASE_URL + '/auth/refresh-token', { refreshToken })",
  "            const { accessToken } = resp.data.data",
  "            api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken",
  "            original.headers['Authorization'] = 'Bearer ' + accessToken",
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
console.log('✅ Created: src/services/api.js     (' + fs.statSync(apiPath).size + ' bytes)')

// ─── 4. Verify all files ──────────────────────────────────────────────────────
console.log('\n📋 Verification:')
const files = [
  'src/store/auth.store.js',
  'src/store/authStore.js',
  'src/services/api.js'
]
let allGood = true
files.forEach(f => {
  const exists  = fs.existsSync(f)
  const content = exists ? fs.readFileSync(f, 'utf8') : ''
  const size    = exists ? fs.statSync(f).size : 0
  const hasExport = content.includes('export')
  console.log('  ' + (exists && hasExport ? '✅' : '❌') + ' ' + f.padEnd(35) + size + ' bytes')
  if (!exists || !hasExport) allGood = false
})

// ─── 5. Check App.jsx imports ─────────────────────────────────────────────────
console.log('\n📋 Import Check:')
const appContent = fs.readFileSync('src/App.jsx', 'utf8')
const line4 = appContent.split('\n').find(l => l.includes('useAuthStore') || l.includes('auth.store') || l.includes('authStore'))
console.log('  App.jsx store import:', line4?.trim())

if (appContent.includes('./store/auth.store')) {
  console.log('  ✅ App.jsx imports from ./store/auth.store - CORRECT')
} else {
  console.log('  ⚠️  App.jsx may need import update')
}

console.log('\n' + (allGood ? '✅ ALL FILES OK!' : '❌ SOME ISSUES REMAIN'))
console.log('\n🚀 Now run:')
console.log('   Terminal 1: cd backend && node src/server.js')
console.log('   Terminal 2: cd frontend && npm run dev')