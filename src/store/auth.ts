import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  display_name: string;
  role: 'PLATFORM_ADMIN' | 'VA_MANAGER' | 'PILOT';
  report_role?: string | null;
  airline_id: string | null;
  pilot_tier: 'FREE_ADS' | 'PRO_SUB';
  is_founder: boolean;
  email_verified: boolean;
  reputation: number;
  avatar_url?: string | null;
  airline?: {
    subscription_tier: string;
    subscription_status: string;
  } | null;
}

interface AuthState {
  user: User | null;
  access_token: string | null;
  refresh_token: string | null;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
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
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),
      setTokens: (access, refresh) => set({ access_token: access, refresh_token: refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, access_token: null, refresh_token: null }),
      isAuthenticated: () => !!get().access_token,
    }),
    {
      name: 'aeronexus-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        access_token: state.access_token,
        refresh_token: state.refresh_token,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
