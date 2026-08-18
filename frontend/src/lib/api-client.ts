/**
 * Axios-based API client for communicating with the EZFINANZ backend.
 *
 * Base URL is read from the VITE_API_BASE_URL environment variable.
 * Interceptors provide consistent error handling.
 * Business-specific API modules will import this client.
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
// Future: attach JWT token from auth store
apiClient.interceptors.request.use(
  (config) => {
    // Placeholder for auth token injection in Phase 1
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
      // Server responded with an error status
      const message =
        error.response.data?.error?.message ||
        error.response.statusText ||
        'An unexpected error occurred';

      return Promise.reject(new Error(message));
    }

    if (error.request) {
      // Request made but no response received
      return Promise.reject(new Error('Unable to reach the server. Please check your connection.'));
    }

    return Promise.reject(error);
  },
);

export default apiClient;
