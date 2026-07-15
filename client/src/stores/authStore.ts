import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { API_BASE_URL } from '@shared/constants/game.js';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar: string;
  role: string;
  level: number;
  xp: number;
  rank: string;
  rankLP: number;
  rankDivision: number;
  mmr: number;
  wins: number;
  losses: number;
  blueEssence: number;
  rp: number;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  fetchUser: () => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

// Setup axios defaults
axios.defaults.baseURL = API_BASE_URL;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await axios.post('/auth/login', { email, password });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        } catch (err: any) {
          set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
          throw err;
        }
      },

      register: async (userData) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await axios.post('/auth/register', userData);
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
        } catch (err: any) {
          set({ error: err.response?.data?.error || 'Registration failed', isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await axios.post('/auth/logout', {}, {
            headers: { Authorization: `Bearer ${get().accessToken}` },
          });
        } catch {
          // Ignore errors
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        delete axios.defaults.headers.common['Authorization'];
      },

      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken;
        if (!refreshToken) return false;
        try {
          const { data } = await axios.post('/auth/refresh', { refreshToken });
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          axios.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          return true;
        } catch {
          set({ isAuthenticated: false, accessToken: null, refreshToken: null });
          return false;
        }
      },

      fetchUser: async () => {
        const token = get().accessToken;
        if (!token) {
          set({ isLoading: false });
          return;
        }
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const { data } = await axios.get('/auth/me');
          set({ user: data, isAuthenticated: true, isLoading: false });
        } catch {
          const refreshed = await get().refreshAccessToken();
          if (refreshed) {
            await get().fetchUser();
          } else {
            set({ isLoading: false, isAuthenticated: false });
          }
        }
      },

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      },
    }),
    {
      name: 'moba-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${state.accessToken}`;
          state.fetchUser();
        } else {
          useAuthStore.setState({ isLoading: false });
        }
      },
    }
  )
);
