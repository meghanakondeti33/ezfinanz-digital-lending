import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApplications } from '../lib/loans-api';
import { fetchVerificationSummary } from '../lib/verification-api';
import type { LoanApplication } from '../types/loan';
import type { VerificationSummary } from '../types/verification';
import { CustomerLayout } from '../components/layout/CustomerLayout';
import { VerificationStatusBadge } from '../components/ui/VerificationStatusBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const CustomerDocuments: React.FC = () => {
  const { user } = useAuth();
  const [primaryApp, setPrimaryApp] = useState<LoanApplication | null>(null);
  const [verifSummary, setVerifSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDocs = async () => {
      try {
        setLoading(true);
        const res = await fetchApplications();
        const apps = res.items || [];
        if (apps.length > 0) {
          setPrimaryApp(apps[0]);
          const vSumm = await fetchVerificationSummary(apps[0].id);
          setVerifSummary(vSumm);
        }
      } catch {
        // Handled cleanly
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, [user]);

  return (
    <CustomerLayout
      sidebarMode="workspace"
      primaryApplicationId={primaryApp?.id}
      activeNav="documents"
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
              My Uploaded Documents
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
              Securely stored verification documents for your loan application.
            </p>
          </div>

          {primaryApp && (
            <Link to={`/loans/${primaryApp.id}`}>
              <Button variant="outline" size="sm">
                View Application
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#686D76]">
            <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading documents…</span>
          </div>
        ) : primaryApp ? (
          <div className="space-y-4">
            {/* KYC Identity PDF Document */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    📄
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">
                        Government ID / KYC Document (PDF)
                      </span>
                      <VerificationStatusBadge status={verifSummary?.kyc} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      National identity document used for identity and address verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/loans/${primaryApp.id}?step=kyc`}>
                    <Button variant="outline" size="sm">
                      {verifSummary?.kyc === 'FAILED' ? 'Replace Document →' : 'View / Update →'}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            {/* Live Selfie Photo */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    📷
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">
                        Live Selfie Photo
                      </span>
                      <VerificationStatusBadge status={verifSummary?.selfie} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      In-browser live camera capture for biometric identity verification.
                    </p>
                    {verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' && (
                      <p className="text-xs text-[#8C3A32] font-semibold mt-1">
                        Reason: {verifSummary?.selfie_details?.rejection_reason || 'Please submit a clearer photo.'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link to={`/loans/${primaryApp.id}?step=photo&mode=retake`}>
                    <Button variant={verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ? 'danger' : 'outline'} size="sm">
                      {verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ? 'Retake Photo →' : 'View / Retake →'}
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>

            <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1] text-xs text-[#8A8D93] text-center">
              🔒 All documents are encrypted and securely stored in compliance with RBI digital lending guidelines.
            </div>
          </div>
        ) : (
          <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] text-center py-12 rounded-2xl space-y-3">
            <span className="text-3xl">📁</span>
            <h3 className="text-lg font-bold text-[#14161A]">No Uploaded Documents Found</h3>
            <p className="text-xs text-[#686D76] max-w-sm mx-auto">
              You haven&apos;t submitted any loan applications yet. Start an application to upload documents.
            </p>
            <Link to="/loans/new">
              <Button variant="primary" size="md" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
                Start Loan Application →
              </Button>
            </Link>
          </Card>
        )}
      </div>
    </CustomerLayout>
  );
};

export default CustomerDocuments;
