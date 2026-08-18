import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api-client';
import { fetchApplications } from '../lib/loans-api';
import type { LoanApplication } from '../types/loan';

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [appsLoading, setAppsLoading] = useState<boolean>(true);
  const [appsError, setAppsError] = useState<string | null>(null);

  const [customerResult, setCustomerResult] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  const [adminResult, setAdminResult] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'CUSTOMER') {
      loadCustomerApplications();
    } else {
      setAppsLoading(false);
    }
  }, [user]);

  const loadCustomerApplications = async () => {
    setAppsLoading(true);
    setAppsError(null);
    try {
      const data = await fetchApplications();
      setApplications(data.items);
    } catch (err: any) {
      setAppsError(err.message || 'Failed to load loan applications.');
    } finally {
      setAppsLoading(false);
    }
  };

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
            <Link to="/" className="text-2xl font-black tracking-tight text-white">
              EZ<span className="text-emerald-400">FINANZ</span>
            </Link>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              Phase 3 Workflow
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
                <h1 className="text-2xl font-bold text-white">Customer Dashboard</h1>
                <p className="text-slate-400 text-sm mt-1">
                  Authenticated as <span className="text-emerald-400 font-semibold">{user?.email}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Role:</span>
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

          {/* Section: My Applications (Customer Role) */}
          {user?.role === 'CUSTOMER' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-white">My Loan Applications</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    Manage and track your active personal loan applications
                  </p>
                </div>
                <Link
                  to="/loans/new"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950/40 transition-all"
                >
                  + Apply for Personal Loan
                </Link>
              </div>

              {appsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <svg className="animate-spin h-6 w-6 text-emerald-400 mx-auto mb-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Loading your applications…</span>
                </div>
              ) : appsError ? (
                <div className="my-6 p-4 rounded-xl bg-red-900/30 border border-red-800 text-red-300 text-sm">
                  {appsError}
                </div>
              ) : applications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl text-slate-400">
                    📄
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">No Loan Applications Found</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                    You have not started any loan applications yet. Click below to begin your personal loan application.
                  </p>
                  <Link
                    to="/loans/new"
                    className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm transition-all"
                  >
                    Start New Loan Application
                  </Link>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {applications.map((app) => {
                    const isDraft = app.status === 'DRAFT';
                    return (
                      <div
                        key={app.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-bold text-white text-base">
                              {app.application_number}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                                isDraft
                                  ? 'bg-yellow-950 text-yellow-300 border border-yellow-800/80'
                                  : 'bg-blue-950 text-blue-300 border border-blue-800/80'
                              }`}
                            >
                              {app.status}
                            </span>
                          </div>

                          <div className="text-sm text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                            <span>
                              <strong className="text-white">
                                {app.requested_amount
                                  ? `₹${Number(app.requested_amount).toLocaleString('en-IN')}`
                                  : 'Amount Pending'}
                              </strong>
                            </span>
                            {app.purpose && (
                              <span className="text-slate-400">• {app.purpose}</span>
                            )}
                            {app.requested_tenure_months && (
                              <span className="text-slate-400">• {app.requested_tenure_months} Months</span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 pt-1">
                            Updated {new Date(app.updated_at).toLocaleDateString()}
                          </div>
                        </div>

                        <div>
                          <Link
                            to={`/loans/${app.id}`}
                            className={`inline-flex items-center px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                              isDraft
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {isDraft ? 'Continue Draft →' : 'View Application →'}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
                    Requires <code className="text-emerald-400 font-mono">CUSTOMER</code> role.
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
                    Requires <code className="text-purple-400 font-mono">ADMIN</code> role.
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
