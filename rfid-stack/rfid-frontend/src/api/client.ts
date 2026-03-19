// src/api/client.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach access token ────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor — auto refresh on 401 ────────────────────────────────
let refreshing = false;
let queue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void; config: InternalAxiosRequestConfig }> = [];

api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const originalReq = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalReq._retry && !originalReq.url?.includes('/auth/')) {
      if (refreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject, config: originalReq }));
      }

      originalReq._retry = true;
      refreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

        queue.forEach(({ resolve, config }) => {
          config.headers.Authorization = `Bearer ${accessToken}`;
          resolve(api(config));
        });
        queue = [];

        return api(originalReq);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        queue.forEach(({ reject }) => reject(error));
        queue = [];
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ── API helpers ────────────────────────────────────────────────────────────────

export const authApi = {
  login:          (email: string, password: string)                => api.post('/auth/login', { email, password }),
  refresh:        (refreshToken: string)                           => api.post('/auth/refresh', { refreshToken }),
  logout:         (refreshToken: string)                           => api.post('/auth/logout', { refreshToken }),
  me:             ()                                               => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string)  => api.put('/auth/change-password', { currentPassword, newPassword }),
};

export const readersApi = {
  list:    (params?: object)         => api.get('/readers', { params }),
  get:     (id: string)              => api.get(`/readers/${id}`),
  stats:   (id: string, hours = 24)  => api.get(`/readers/${id}/stats`, { params: { hours } }),
  create:  (data: object)            => api.post('/readers', data),
  update:  (id: string, data: object)=> api.put(`/readers/${id}`, data),
  remove:  (id: string)              => api.delete(`/readers/${id}`),
  restart: (id: string)              => api.post(`/readers/${id}/restart`),
};

export const productsApi = {
  overview: ()                                    => api.get('/products/overview'),
  list:     (params?: object)                     => api.get('/products', { params }),
  get:      (id: string)                          => api.get(`/products/${id}`),
  create:   (data: object)                        => api.post('/products', data),
  update:   (id: string, data: object)            => api.put(`/products/${id}`, data),
  remove:   (id: string)                          => api.delete(`/products/${id}`),
};

export const tagsApi = {
  list:      (params?: object)                       => api.get('/tags', { params }),
  get:       (epc: string)                           => api.get(`/tags/${epc}`),
  associate: (epc: string, productId: string)        => api.post(`/tags/${epc}/associate`, { productId }),
  setStatus: (epc: string, status: string)           => api.put(`/tags/${epc}/status`, { status }),
};

export const scansApi = {
  list:  (params?: object) => api.get('/scans', { params }),
  stats: (params?: object) => api.get('/scans/stats', { params }),
};

export const alertsApi = {
  list:       (params?: object) => api.get('/alerts', { params }),
  resolve:    (id: string)      => api.put(`/alerts/${id}/resolve`),
  readAll:    ()                => api.put('/alerts/read-all'),
};

export const reportsApi = {
  scans:     (params?: object)  => api.get('/reports/scans', { params, responseType: 'blob' }),
  inventory: (params?: object)  => api.get('/reports/inventory', { params, responseType: 'blob' }),
};

export const healthApi = {
  check: () => api.get('/health'),
};
