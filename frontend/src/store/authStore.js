// frontend/src/store/authStore.js
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user:            null,
      accessToken:     null,
      refreshToken:    null,
      isLoading:       false,
      error:           null,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', {
            email:    email.trim().toLowerCase(),
            password
          })
          const { user, accessToken, refreshToken } = response.data.data
          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading:       false,
            error:           null
          })
          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.message || 'Login failed. Check credentials.'
          set({
            isLoading:       false,
            error:           message,
            isAuthenticated: false,
            user:            null,
            accessToken:     null,
            refreshToken:    null
          })
          return { success: false, message }
        }
      },

      logout: async () => {
        try {
          const { accessToken } = get()
          if (accessToken) {
            await api.post('/auth/logout').catch(() => {})
          }
        } catch (_) {}
        delete api.defaults.headers.common['Authorization']
        set({
          user:            null,
          accessToken:     null,
          refreshToken:    null,
          isAuthenticated: false,
          error:           null,
          isLoading:       false
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          get().logout()
          return false
        }
        try {
          const response = await api.post('/auth/refresh-token', { refreshToken })
          const { accessToken, refreshToken: newRefresh, user } = response.data.data
          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken
          set({
            accessToken,
            refreshToken: newRefresh || refreshToken,
            user:         user || get().user
          })
          return true
        } catch (_) {
          get().logout()
          return false
        }
      },

      getProfile: async () => {
        try {
          const response = await api.get('/auth/profile')
          const user     = response.data.data?.user
          if (user) set({ user })
          return user
        } catch (_) {
          return null
        }
      },

      initialize: () => {
        const { accessToken, isAuthenticated } = get()
        if (accessToken && isAuthenticated) {
          api.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken
        }
      },

      clearError: () => set({ error: null }),

      updateUser: (userData) => set({ user: { ...get().user, ...userData } }),

      isAdmin: () => {
        const { user } = get()
        return ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MEDICAL_DIRECTOR'].includes(user?.role)
      },

      hasRole: (...roles) => {
        const { user } = get()
        return roles.includes(user?.role)
      },

      getFullName: () => {
        const { user } = get()
        if (!user) return ''
        return user.firstName + ' ' + user.lastName
      },

      getInitials: () => {
        const { user } = get()
        if (!user) return 'U'
        return (user.firstName?.[0] || '') + (user.lastName?.[0] || '')
      }
    }),
    {
      name:    'steverest-hims-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user:            state.user,
        accessToken:     state.accessToken,
        refreshToken:    state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)

export default useAuthStore