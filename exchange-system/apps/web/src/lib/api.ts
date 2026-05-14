import axios from 'axios';

const api = axios.create({
  // Always use a relative path so the browser calls the same host/port
  // that served the page. Next.js rewrites (next.config.ts) forward
  // /api/v1/* to the NestJS backend at runtime via API_INTERNAL_URL.
  baseURL: '/api/v1',
  withCredentials: false,
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login on 401 — but NOT during the pre-auth flow where
// 401 means "wrong code" and the page should display the error itself.
const PRE_AUTH_PATHS = [
  '/auth/totp/setup',
  '/auth/totp/enroll',
  '/auth/totp/verify',
  '/auth/change-password',
];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url: string = error.config?.url ?? '';
    const isPreAuth = PRE_AUTH_PATHS.some((p) => url.includes(p));
    if (error.response?.status === 401 && !isPreAuth && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
