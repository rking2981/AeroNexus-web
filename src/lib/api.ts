import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Public client — no auth, no logout-on-401. Use for unauthenticated endpoints.
export const publicApi = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Attach access token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

// Auto-refresh on 401 — only redirect to login if refresh itself fails with 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Not a 401, or already retried — just reject
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // If refresh is already in progress, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          original._retry = true;
          resolve(api(original));
        });
        // Reject after 10s to avoid hanging forever
        setTimeout(() => reject(error), 10000);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) throw new Error('no_refresh_token');

      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } },
      );

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);

      processQueue(data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError: unknown) {
      refreshQueue = [];

      // Only force logout if the refresh endpoint itself returned 401
      // (meaning the refresh token is genuinely expired/invalid)
      const refreshStatus = (refreshError as { response?: { status?: number } })?.response?.status;
      if (refreshStatus === 401 || (refreshError as Error)?.message === 'no_refresh_token') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      // For network errors, timeouts, etc. — DON'T logout, just reject the request
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
