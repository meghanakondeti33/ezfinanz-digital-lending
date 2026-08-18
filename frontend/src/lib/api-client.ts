/**
 * Axios-based API client for communicating with the EZFINANZ backend.
 *
 * Base URL is read from the VITE_API_BASE_URL environment variable.
 * Automatically injects the JWT Bearer token from local storage if present.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// ── Request interceptor ──────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ezfinanz_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor ─────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalize error shape for consumers
    if (error.response) {
      const message =
        error.response.data?.error?.message ||
        error.response.data?.detail ||
        error.response.statusText ||
        'An unexpected error occurred';

      return Promise.reject(new Error(message));
    }

    if (error.request) {
      return Promise.reject(new Error('Unable to reach the server. Please check your connection.'));
    }

    return Promise.reject(error);
  },
);

export default apiClient;
