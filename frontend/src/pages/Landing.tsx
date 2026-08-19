/**
 * Landing page — proves the frontend is running and can
 * communicate with the backend via the health endpoint.
 * Provides quick access to Auth features (Sign In / Register / Dashboard).
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/api-client';
import { useAuth } from '../context/AuthContext';

interface HealthResponse {
  status: string;
}

function Landing() {
  const { isAuthenticated, user } = useAuth();

  const { data, isLoading, isError, error } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await apiClient.get<HealthResponse>('/health');
      return res.data;
    },
    refetchInterval: 30000,
    retry: 2,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-extrabold tracking-tight text-white mb-2">
            EZ<span className="text-emerald-400">FINANZ</span>
          </h1>
          <p className="text-slate-400 text-lg">
            Personal Loan Application Platform
          </p>
        </div>

        {/* Auth Action Card */}
        <div className="mb-6 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
          <h2 className="text-white text-lg font-bold mb-3">Authentication & Portals</h2>
          <p className="text-slate-400 text-sm mb-5">
            Phase 2: Secure Argon2id password hashing, JWT access tokens, and server-enforced RBAC.
          </p>

          {isAuthenticated ? (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Active Session</span>
                  <span className="font-semibold text-white">{user?.email}</span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    user?.role === 'ADMIN'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
              <Link
                to={user?.role === 'ADMIN' ? '/admin' : '/dashboard'}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg cursor-pointer"
              >
                {user?.role === 'ADMIN' ? 'Go to Underwriting Portal →' : 'Go to Customer Dashboard →'}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/login"
                className="flex justify-center items-center py-2.5 px-4 rounded-xl font-bold text-xs text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all shadow-lg"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="flex justify-center items-center py-2.5 px-4 rounded-xl font-bold text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* System Status Card */}
        <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-white text-md font-semibold mb-4">
            System Liveness
          </h2>

          <div className="space-y-3">
            {/* Frontend Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Frontend Client</span>
              <span className="flex items-center gap-2 text-emerald-400 font-medium">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Running
              </span>
            </div>

            <div className="border-t border-slate-800"></div>

            {/* Backend Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Backend API</span>
              {isLoading && (
                <span className="flex items-center gap-2 text-yellow-400 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse"></span>
                  Checking…
                </span>
              )}
              {isError && (
                <span className="flex items-center gap-2 text-red-400 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  Offline
                </span>
              )}
              {data && (
                <span className="flex items-center gap-2 text-emerald-400 font-medium">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  {data.status === 'ok' ? 'Connected' : data.status}
                </span>
              )}
            </div>

            {isError && (
              <p className="text-xs text-red-400/80 mt-2">
                {(error as Error)?.message || 'Could not reach the backend.'}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          EZFINANZ Technical Assessment — Phase 2 Architecture
        </p>
      </div>
    </div>
  );
}

export default Landing;
