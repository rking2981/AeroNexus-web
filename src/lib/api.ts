import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const STORE_KEY = 'aeronexus-auth';

// Read tokens from Zustand's persisted JSON blob, not raw localStorage keys
function getTokens(): { access_token: string | null; refresh_token: string | null } {
  if (typeof window === 'undefined') return { access_token: null, refresh_token: null };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { access_token: null, refresh_token: null };
    const parsed = JSON.parse(raw);
    return {
      access_token: parsed?.state?.access_token ?? null,
      refresh_token: parsed?.state?.refresh_token ?? null,
    };
  } catch {
    return { access_token: null, refresh_token: null };
  }
}

function setTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state.access_token = access;
    parsed.state.refresh_token = refresh;
    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
  } catch { /* ignore */ }
}

function clearTokens() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state.access_token = null;
    parsed.state.refresh_token = null;
    parsed.state.user = null;
    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
  } catch { /* ignore */ }
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Public client — no auth, no logout-on-401
export const publicApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Attach access token from Zustand store on every request
api.interceptors.request.use((config) => {
  const { access_token } = getTokens();
  if (access_token) config.headers.Authorization = `Bearer ${access_token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      console.log(`[AeroNexus API] Request failed — status: ${error.response?.status}, url: ${original.url}`);
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          original._retry = true;
          resolve(api(original));
        });
        setTimeout(() => reject(error), 10000);
      });
    }

    original._retry = true;
    isRefreshing = true;

    console.log(`[AeroNexus API] 401 on ${original.url} — attempting token refresh`);

    try {
      const { refresh_token } = getTokens();
      if (!refresh_token) {
        console.warn('[AeroNexus API] No refresh token found in Zustand store');
        throw new Error('no_refresh_token');
      }

      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refresh_token}` } },
      );

      console.log('[AeroNexus API] Token refresh successful');
      setTokens(data.access_token, data.refresh_token);

      processQueue(data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError: unknown) {
      refreshQueue = [];

      const refreshStatus = (refreshError as { response?: { status?: number } })?.response?.status;
      console.error('[AeroNexus API] Token refresh failed', {
        refreshStatus,
        message: (refreshError as Error)?.message,
        willLogout: refreshStatus === 401 || (refreshError as Error)?.message === 'no_refresh_token',
      });

      if (refreshStatus === 401 || (refreshError as Error)?.message === 'no_refresh_token') {
        console.warn('[AeroNexus API] ⚠️ Logging out — refresh token invalid or missing');
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
