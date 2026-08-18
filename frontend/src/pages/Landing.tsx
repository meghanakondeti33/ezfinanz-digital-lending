/**
 * Landing page — proves the frontend is running and can
 * communicate with the backend via the health endpoint.
 */

import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';

interface HealthResponse {
  status: string;
}

function Landing() {
  const { data, isLoading, isError, error } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await apiClient.get<HealthResponse>('/health');
      return res.data;
    },
    refetchInterval: 30000, // poll every 30s
    retry: 2,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-2">
            EZ<span className="text-emerald-400">FINANZ</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Personal Loan Application Platform
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/60 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-white text-xl font-semibold mb-6">
            System Status
          </h2>

          <div className="space-y-4">
            {/* Frontend Status */}
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Frontend</span>
              <span className="flex items-center gap-2 text-emerald-400 font-medium">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Running
              </span>
            </div>

            <div className="border-t border-slate-700"></div>

            {/* Backend Status */}
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Backend API</span>
              {isLoading && (
                <span className="flex items-center gap-2 text-yellow-400 font-medium">
                  <span className="h-3 w-3 rounded-full bg-yellow-400 animate-pulse"></span>
                  Checking…
                </span>
              )}
              {isError && (
                <span className="flex items-center gap-2 text-red-400 font-medium">
                  <span className="h-3 w-3 rounded-full bg-red-500"></span>
                  Offline
                </span>
              )}
              {data && (
                <span className="flex items-center gap-2 text-emerald-400 font-medium">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  {data.status === 'ok' ? 'Connected' : data.status}
                </span>
              )}
            </div>

            {isError && (
              <p className="text-sm text-red-400/80 mt-2">
                {(error as Error)?.message || 'Could not reach the backend.'}
              </p>
            )}
          </div>

          {/* Endpoint Info */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 font-mono">
              GET /api/v1/health →{' '}
              {data ? (
                <span className="text-emerald-400">{JSON.stringify(data)}</span>
              ) : (
                <span className="text-slate-600">waiting…</span>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-8">
          Phase 0 — Foundation
        </p>
      </div>
    </div>
  );
}

export default Landing;
