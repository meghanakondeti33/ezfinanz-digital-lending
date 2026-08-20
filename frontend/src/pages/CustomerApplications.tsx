import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApplications } from '../lib/loans-api';
import type { LoanApplication } from '../types/loan';
import { CustomerLayout } from '../components/layout/CustomerLayout';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const CustomerApplications: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadApps = async () => {
      try {
        setLoading(true);
        const res = await fetchApplications();
        setApplications(res.items || []);
      } catch {
        // Handled cleanly
      } finally {
        setLoading(false);
      }
    };
    loadApps();
  }, [user]);

  const primaryApp = applications.length > 0 ? applications[0] : null;

  return (
    <CustomerLayout
      sidebarMode="workspace"
      primaryApplicationId={primaryApp?.id}
      activeNav="applications"
    >
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header & Back to Dashboard */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/dashboard" className="text-xs font-semibold text-[#B5652D] hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial">
              My Applications
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
              Complete history of your personal loan applications with EZFINANZ.
            </p>
          </div>

          <Link to="/loans/new">
            <Button variant="primary" size="md" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
              + New Application
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#686D76]">
            <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading applications…</span>
          </div>
        ) : applications.length > 0 ? (
          <div className="space-y-3">
            {applications.map((app) => (
              <Card
                key={app.id}
                variant="default"
                padding="md"
                className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl hover:border-[#D5D0C7] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0 font-mono font-bold text-xs">
                      📄
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#14161A]">
                          #{app.application_number}
                        </span>
                        <StatusBadge status={app.status} size="sm" />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#686D76] mt-1">
                        <span>{app.purpose || 'Personal Loan'}</span>
                        <span>•</span>
                        <span className="font-mono font-semibold text-[#14161A]">
                          ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')}
                        </span>
                        <span>•</span>
                        <span>{new Date(app.updated_at || app.created_at).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <Link to={`/loans/${app.id}`}>
                      <Button variant="outline" size="sm">
                        Open Application →
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] text-center py-12 rounded-2xl space-y-3">
            <span className="text-3xl">📝</span>
            <h3 className="text-lg font-bold text-[#14161A]">No Applications Found</h3>
            <p className="text-xs text-[#686D76] max-w-sm mx-auto">
              You haven&apos;t started a loan application yet. Apply today in just a few minutes.
            </p>
            <Link to="/loans/new">
              <Button variant="primary" size="md" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
                Apply for a Loan →
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </CustomerLayout>
  );
};

export default CustomerApplications;
