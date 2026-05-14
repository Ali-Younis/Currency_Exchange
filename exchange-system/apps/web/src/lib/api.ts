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

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
