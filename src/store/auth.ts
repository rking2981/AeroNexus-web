import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'PLATFORM_ADMIN' | 'VA_MANAGER' | 'PILOT';
  airline_id: string | null;
  pilot_tier: 'FREE_ADS' | 'PRO_SUB';
  is_founder: boolean;
  reputation: number;
}

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      access_token: null,
      refresh_token: null,
      setTokens: (access, refresh) => set({ access_token: access, refresh_token: refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, access_token: null, refresh_token: null }),
      isAuthenticated: () => !!get().access_token,
    }),
    {
      name: 'aeronexus-auth',
      partialize: (state) => ({
        access_token: state.access_token,
        refresh_token: state.refresh_token,
        user: state.user,
      }),
    },
  ),
);
