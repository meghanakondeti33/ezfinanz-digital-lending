/**
 * Axios-based API client for communicating with the EZFINANZ backend.
 *
 * Base URL is read from the VITE_API_BASE_URL environment variable.
 * Automatically injects the JWT Bearer token from local storage if present.
 */

import axios from 'axios';
import { extractErrorMessage } from './error-utils';

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
    // Normalize error into a clean, human-readable Error instance
    const message = extractErrorMessage(error);
    return Promise.reject(new Error(message));
  },
);

export default apiClient;
