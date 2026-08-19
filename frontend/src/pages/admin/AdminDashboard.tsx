import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminApplications, fetchAdminDashboardStats } from '../../lib/admin-api';
import type {
  AdminApplicationQueueItem,
  AdminDashboardStats,
} from '../../types/admin';
import { extractErrorMessage } from '../../lib/error-utils';

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [applications, setApplications] = useState<AdminApplicationQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, queueData] = await Promise.all([
        fetchAdminDashboardStats(),
        fetchAdminApplications(statusFilter, search),
      ]);
      setStats(statsData);
      setApplications(queueData.applications);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load admin queue.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'UNDER_REVIEW':
        return 'bg-amber-950/60 border-amber-700 text-amber-300 animate-pulse';
      case 'APPROVED':
        return 'bg-emerald-950/60 border-emerald-700 text-emerald-300';
      case 'REJECTED':
        return 'bg-rose-950/60 border-rose-700 text-rose-300';
      case 'OFFER_SELECTED':
        return 'bg-blue-950/60 border-blue-700 text-blue-300';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Admin Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/admin" className="flex items-center space-x-2">
              <span className="text-2xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                EZFINANZ
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-950 border border-indigo-700 text-indigo-300">
                Underwriting Portal
              </span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold text-slate-200 block">{user?.email}</span>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Credit Officer (Admin)</span>
            </div>
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Underwriting & Application Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review customer loan applications, verify credit risk indicators, and make approval decisions.
          </p>
        </div>

        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-amber-900/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Awaiting Review</span>
              <span className="text-lg">⏳</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-2">
              {stats?.under_review_count ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Completed verification pipeline</span>
          </div>

          <div className="bg-slate-900/90 border border-emerald-900/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Approved Loans</span>
              <span className="text-lg">✅</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-2">
              {stats?.approved_count ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Ready for disbursement</span>
          </div>

          <div className="bg-slate-900/90 border border-rose-900/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Rejected Loans</span>
              <span className="text-lg">❌</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-2">
              {stats?.rejected_count ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Declined applications</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Applications</span>
              <span className="text-lg">📊</span>
            </div>
            <div className="text-3xl font-black text-white font-mono mt-2">
              {stats?.total_applications ?? 0}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Across all states</span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {st === 'ALL'
                  ? 'All Applications'
                  : st === 'UNDER_REVIEW'
                  ? 'Under Review'
                  : st === 'APPROVED'
                  ? 'Approved'
                  : 'Rejected'}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search app #, email, phone..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
            >
              Search
            </button>
          </form>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Application Queue Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Application Records ({applications.length})
            </span>
            <button
              onClick={loadData}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <span>↻</span> Refresh Queue
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400 animate-pulse">
              <div className="h-4 w-48 bg-slate-800 rounded mx-auto mb-2"></div>
              <p className="text-xs">Loading application records...</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-slate-300">No applications match current filters.</p>
              <p className="text-xs text-slate-500">Applications submitted by customers will appear in this queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">Application #</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Loan Amount</th>
                    <th className="py-3.5 px-4">Eligibility Score</th>
                    <th className="py-3.5 px-4">Selected Offer</th>
                    <th className="py-3.5 px-4">Verification</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {app.application_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-white block">
                          {app.customer_name || 'Anonymous Applicant'}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{app.customer_email}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">
                        {app.requested_amount ? `₹${Number(app.requested_amount).toLocaleString('en-IN')}` : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4">
                        {app.eligibility_score ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-400">
                              {Number(app.eligibility_score).toFixed(0)}/100
                            </span>
                            <span className="text-[10px] text-slate-400">({app.eligibility_status})</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Not Evaluated</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {app.selected_offer_emi ? (
                          <div>
                            <span className="font-mono font-semibold text-white block">
                              ₹{Number(app.selected_offer_emi).toLocaleString('en-IN')}/mo
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {app.selected_offer_rate}% p.a.
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">No Offer Selected</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            app.verification_status === 'COMPLETED'
                              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                              : app.verification_status === 'IN_PROGRESS'
                              ? 'bg-blue-950/60 border-blue-700 text-blue-300'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {app.verification_status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${getStatusBadgeClass(
                            app.status
                          )}`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          to={`/admin/applications/${app.id}`}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all inline-block"
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
