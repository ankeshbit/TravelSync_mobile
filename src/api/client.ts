import axios, { AxiosError, InternalAxiosRequestConfig, isAxiosError } from 'axios';
import { auth } from '@/config/firebase';
import { getApiBaseUrl } from '@/config/env';

export interface CustomRequestConfig extends InternalAxiosRequestConfig {
  _firebaseRetry?: boolean;
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach fresh Firebase ID token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        // getIdToken(false) returns cached token, refreshing automatically when near expiry
        const token = await currentUser.getIdToken(false);
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Proceed without token if auth is not ready or user is not signed in
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-retry on 401 with force-refreshed token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomRequestConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._firebaseRetry) {
      originalRequest._firebaseRetry = true;
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const freshToken = await currentUser.getIdToken(true);
          originalRequest.headers.Authorization = `Bearer ${freshToken}`;
          return api(originalRequest);
        }
      } catch {
        // Token refresh failed, continue to reject
      }
    }

    return Promise.reject(error);
  }
);

export function getErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) {
      return 'Network error. Please check your server connection or backend URL.';
    }
    const data = error.response.data as { message?: string; error?: string } | undefined;
    if (data?.message) return data.message;
    if (data?.error) return data.error;
    if (error.response.status === 401) return 'Session expired. Please log in again.';
    if (error.response.status === 403) return 'You do not have permission to access this resource.';
    if (error.response.status === 404) return 'The requested resource was not found.';
    if (error.response.status >= 500) return 'Server error. Please try again later.';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}

export default api;
