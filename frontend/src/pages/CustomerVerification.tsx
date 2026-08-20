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

export const CustomerVerification: React.FC = () => {
  const { user } = useAuth();
  const [primaryApp, setPrimaryApp] = useState<LoanApplication | null>(null);
  const [verifSummary, setVerifSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
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
    loadData();
  }, [user]);

  // Compute completed count out of 4
  const completedCount = [
    verifSummary?.kyc === 'VERIFIED',
    verifSummary?.bank_account === 'VERIFIED',
    verifSummary?.selfie === 'PHOTO_APPROVED' || verifSummary?.selfie === 'VERIFIED',
    verifSummary?.declaration === 'ACCEPTED',
  ].filter(Boolean).length;

  return (
    <CustomerLayout
      sidebarMode="workspace"
      primaryApplicationId={primaryApp?.id}
      activeNav="verification"
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
              Identity & Account Verification
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
              {completedCount} of 4 steps completed for loan application #{primaryApp?.application_number || '—'}
            </p>
          </div>

          {primaryApp && (
            <Link to={`/loans/${primaryApp.id}?step=kyc`}>
              <Button variant="primary" size="md" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
                Continue Verification →
              </Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#686D76]">
            <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading verification status…</span>
          </div>
        ) : primaryApp ? (
          <div className="space-y-4">
            {/* Step 1: KYC Identity Document */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    🪪
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">1. KYC Identity Document</span>
                      <VerificationStatusBadge status={verifSummary?.kyc} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      Government ID PDF upload for automated/credit officer verification.
                    </p>
                  </div>
                </div>
                <Link to={`/loans/${primaryApp.id}?step=kyc`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    {verifSummary?.kyc === 'VERIFIED' ? 'View Details →' : 'Complete Step →'}
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Step 2: Bank Account Verification */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    🏦
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">2. Bank Account (Penny Drop)</span>
                      <VerificationStatusBadge status={verifSummary?.bank_account} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      Bank account & IFSC validation for seamless automated loan disbursement.
                    </p>
                  </div>
                </div>
                <Link to={`/loans/${primaryApp.id}?step=bank`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    {verifSummary?.bank_account === 'VERIFIED' ? 'View Details →' : 'Complete Step →'}
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Step 3: Live Photo / Selfie */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    📷
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">3. Live Selfie Capture</span>
                      <VerificationStatusBadge status={verifSummary?.selfie} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      Facial liveness verification to prevent fraudulent loan applications.
                    </p>
                    {verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' && (
                      <p className="text-xs text-[#8C3A32] font-semibold mt-1">
                        Reason: {verifSummary?.selfie_details?.rejection_reason || 'Please submit a clearer photo.'}
                      </p>
                    )}
                  </div>
                </div>
                <Link to={`/loans/${primaryApp.id}?step=photo&mode=retake`} className="shrink-0">
                  <Button variant={verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ? 'danger' : 'outline'} size="sm">
                    {verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ? 'Retake Photo →' : 'Complete Step →'}
                  </Button>
                </Link>
              </div>
            </Card>

            {/* Step 4: Legal Declaration */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl shrink-0">
                    📜
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#14161A]">4. Legal Declaration & Consent</span>
                      <VerificationStatusBadge status={verifSummary?.declaration} size="sm" />
                    </div>
                    <p className="text-xs text-[#686D76] mt-0.5">
                      Borrower digital agreement and consent for loan agreement processing.
                    </p>
                  </div>
                </div>
                <Link to={`/loans/${primaryApp.id}?step=declaration`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    {verifSummary?.declaration === 'ACCEPTED' ? 'View Declaration →' : 'Complete Step →'}
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        ) : (
          <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] text-center py-12 rounded-2xl space-y-3">
            <span className="text-3xl">🛡️</span>
            <h3 className="text-lg font-bold text-[#14161A]">No Active Application to Verify</h3>
            <p className="text-xs text-[#686D76] max-w-sm mx-auto">
              You haven&apos;t submitted a loan application yet. Start an application to begin verification.
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

export default CustomerVerification;
