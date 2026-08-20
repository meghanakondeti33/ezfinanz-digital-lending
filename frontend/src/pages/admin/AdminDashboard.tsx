import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminApplications, fetchAdminDashboardStats } from '../../lib/admin-api';
import type {
  AdminApplicationQueueItem,
  AdminDashboardStats,
} from '../../types/admin';
import { extractErrorMessage } from '../../lib/error-utils';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter') || 'ALL';

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [applications, setApplications] = useState<AdminApplicationQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>(urlFilter);
  const [search, setSearch] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const f = searchParams.get('filter') || 'ALL';
    setStatusFilter(f);
  }, [searchParams]);

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
      setError(extractErrorMessage(err, 'Failed to load underwriter queue.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    if (filter === 'ALL') {
      searchParams.delete('filter');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ filter }, { replace: true });
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <AdminLayout activeFilter={statusFilter} onSelectFilter={handleFilterChange}>
      <div className="space-y-6">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5E2DC] pb-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9C4F1C] font-mono">
              Credit Underwriting Console
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial tracking-tight mt-0.5">
              Application Queue & Risk Review
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
              Review case files, verify customer documentation, and authorize loan decisions.
            </p>
          </div>

          <div className="text-xs text-[#686D76]">
            Reviewer: <strong className="text-[#14161A]">{user?.email}</strong>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs shadow-xs">
            ⚠️ {error}
          </div>
        )}

        {/* High-Level Portfolio Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card variant="default" padding="sm" className="space-y-1 bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#686D76]">Total Applications</span>
            <span className="text-2xl font-bold text-[#14161A] font-mono block">
              {stats?.total_applications ?? 0}
            </span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1 border-l-4 border-l-[#A8752B] bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#A8752B]">Under Review</span>
            <span className="text-2xl font-bold text-[#14161A] font-mono block">
              {stats?.under_review_count ?? 0}
            </span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1 border-l-4 border-l-[#1E5C4A] bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1E5C4A]">Approved Loans</span>
            <span className="text-2xl font-bold text-[#14161A] font-mono block">
              {stats?.approved_count ?? 0}
            </span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1 border-l-4 border-l-[#8C3A32] bg-white">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8C3A32]">Declined Loans</span>
            <span className="text-2xl font-bold text-[#14161A] font-mono block">
              {stats?.rejected_count ?? 0}
            </span>
          </Card>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#E5E2DC] shadow-xs">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['ALL', 'UNDER_REVIEW', 'OFFER_SELECTED', 'APPROVED', 'DISBURSEMENT_PROCESSING', 'DISBURSED', 'DRAFT', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => handleFilterChange(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#14161A] text-white shadow-xs'
                    : 'text-[#686D76] hover:bg-[#F2EFE9] hover:text-[#14161A]'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-72 flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by app #, email, name"
              className="py-1 text-xs"
            />
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
        </div>

        {/* Case File Queue Table */}
        <Card variant="default" padding="none" className="overflow-hidden bg-white shadow-xs rounded-2xl border border-[#E5E2DC]">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-xs text-[#686D76]">Refreshing underwriter queue…</p>
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#686D76]">
              No applications matching the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-[#686D76] uppercase text-[10px] font-bold tracking-wider border-b border-[#E5E2DC]">
                  <tr>
                    <th className="px-5 py-3.5">Application #</th>
                    <th className="px-5 py-3.5">Applicant</th>
                    <th className="px-5 py-3.5">Requested Loan</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Submitted Date</th>
                    <th className="px-5 py-3.5 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2DC]">
                  {applications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-[#14161A]">
                        {app.application_number}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#14161A]">{app.customer_name || 'N/A'}</div>
                        <div className="text-[11px] text-[#686D76]">{app.customer_email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-[#14161A]">
                          ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-[#686D76]">{app.purpose || 'Personal'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={app.status} size="sm" />
                      </td>
                      <td className="px-5 py-4 text-[#686D76]">
                        {new Date(app.updated_at || app.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link to={`/admin/applications/${app.id}`}>
                          <Button variant="outline" size="sm">
                            Open Case File →
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
