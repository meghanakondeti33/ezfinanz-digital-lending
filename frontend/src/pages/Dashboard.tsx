import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api-client';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const [customerResult, setCustomerResult] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  const [adminResult, setAdminResult] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const handleTestCustomerEndpoint = async () => {
    setCustomerLoading(true);
    setCustomerResult(null);
    try {
      const res = await apiClient.get('/customer/test');
      setCustomerResult(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setCustomerResult(`Error: ${err.message}`);
    } finally {
      setCustomerLoading(false);
    }
  };

  const handleTestAdminEndpoint = async () => {
    setAdminLoading(true);
    setAdminResult(null);
    try {
      const res = await apiClient.get('/admin/test');
      setAdminResult(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setAdminResult(`Error: ${err.message}`);
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Navigation Header */}
      <nav className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl font-black tracking-tight text-white">
              EZ<span className="text-emerald-400">FINANZ</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              Phase 2 Auth
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-400 hidden sm:inline-block">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl transition-all border border-slate-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="space-y-8">
          {/* User Profile Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-white">Authenticated Profile</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Validated against <code className="text-emerald-400 font-mono text-xs">GET /api/v1/auth/me</code>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Assigned Role:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    user?.role === 'ADMIN'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  }`}
                >
                  {user?.role}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">User ID</span>
                <span className="block text-sm font-mono text-slate-300 mt-1 break-all">{user?.id}</span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Email</span>
                <span className="block text-sm text-slate-200 mt-1">{user?.email}</span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Mobile Number</span>
                <span className="block text-sm text-slate-200 mt-1">{user?.phone}</span>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-500 uppercase tracking-wider">Account Status</span>
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                  {user?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Role-Based Access Control Verification Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
            <h2 className="text-xl font-bold text-white mb-2">Role-Based Authorization Verification</h2>
            <p className="text-slate-400 text-sm mb-6">
              Test backend role enforcement in real-time. The backend validates permissions for every request.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Route Test */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-emerald-400">Customer Test Endpoint</span>
                    <span className="text-xs font-mono text-slate-500">GET /customer/test</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Requires <code className="text-emerald-400 font-mono">CUSTOMER</code> role. Should succeed for customer accounts.
                  </p>
                </div>

                <div>
                  <button
                    onClick={handleTestCustomerEndpoint}
                    disabled={customerLoading}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                  >
                    {customerLoading ? 'Calling endpoint…' : 'Execute Customer Test'}
                  </button>

                  {customerResult && (
                    <pre className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                      {customerResult}
                    </pre>
                  )}
                </div>
              </div>

              {/* Admin Route Test */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-400">Admin Test Endpoint</span>
                    <span className="text-xs font-mono text-slate-500">GET /admin/test</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Requires <code className="text-purple-400 font-mono">ADMIN</code> role. Returns 403 Forbidden for customer accounts.
                  </p>
                </div>

                <div>
                  <button
                    onClick={handleTestAdminEndpoint}
                    disabled={adminLoading}
                    className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all disabled:opacity-50"
                  >
                    {adminLoading ? 'Calling endpoint…' : 'Execute Admin Test'}
                  </button>

                  {adminResult && (
                    <pre className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                      {adminResult}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
