import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api-client';
import { fetchApplications } from '../lib/loans-api';
import { fetchCustomerDisbursement } from '../lib/disbursement-api';
import { fetchVerificationSummary } from '../lib/verification-api';
import { formatHeaderUserName } from '../components/layout/AppHeader';
import type { LoanApplication } from '../types/loan';
import type { DisbursementDetail } from '../types/disbursement';
import type { VerificationSummary } from '../types/verification';
import { extractErrorMessage } from '../lib/error-utils';
import { CustomerLayout } from '../components/layout/CustomerLayout';
import { LOAN_STAGES, getStageState } from '../components/journey/LoanJourneySidebar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [primaryDisbursement, setPrimaryDisbursement] = useState<DisbursementDetail | null>(null);
  const [primaryVerifSummary, setPrimaryVerifSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Redirect Admin directly to Admin Console
      if (user?.role === 'ADMIN') {
        navigate('/admin', { replace: true });
        return;
      }

      const response = await fetchApplications();
      const apps = response.items || [];
      setApplications(apps);

      if (apps.length > 0) {
        const primary = apps[0];

        try {
          const vSumm = await fetchVerificationSummary(primary.id);
          setPrimaryVerifSummary(vSumm);
        } catch {
          // Handled cleanly
        }

        if (
          primary.status === 'APPROVED' ||
          primary.status === 'DISBURSEMENT_PROCESSING' ||
          primary.status === 'DISBURSED'
        ) {
          try {
            const disb = await fetchCustomerDisbursement(primary.id);
            setPrimaryDisbursement(disb);
          } catch {
            // Handled cleanly
          }
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load borrower dashboard.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setResendSuccess(null);
    setError(null);
    try {
      await apiClient.post('/auth/resend-verification-email');
      setResendSuccess('✓ A fresh verification link has been sent to your email.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to send verification email.'));
    } finally {
      setResendingEmail(false);
    }
  };

  const primaryApp = applications.length > 0 ? applications[0] : null;

  // Derive verification count out of 4
  const verificationCompletedCount = [
    primaryVerifSummary?.kyc === 'VERIFIED',
    primaryVerifSummary?.bank_account === 'VERIFIED',
    primaryVerifSummary?.selfie === 'PHOTO_APPROVED' || primaryVerifSummary?.selfie === 'VERIFIED',
    primaryVerifSummary?.declaration === 'ACCEPTED',
  ].filter(Boolean).length;

  const hasPhotoRetake = primaryVerifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED';
  const hasKycReplacement = primaryVerifSummary?.kyc === 'FAILED';

  // Determine the authoritative Single Next Action & Primary CTA
  interface NextActionMeta {
    icon: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaPath: string;
    isUrgent?: boolean;
  }

  const getNextAction = (): NextActionMeta | null => {
    if (!user?.email_verified) {
      return {
        icon: '✉️',
        title: 'Verify your email address',
        description: `Please verify your email (${user?.email}) to secure your loan account and receive real-time notifications.`,
        ctaLabel: 'Resend Verification Link →',
        ctaPath: '#resend-email',
        isUrgent: true,
      };
    }

    if (!primaryApp) {
      return {
        icon: '📝',
        title: 'Start your loan application',
        description: 'Check your eligibility and get instant pre-approved personal loan offers in minutes.',
        ctaLabel: 'Apply for a Loan →',
        ctaPath: '/loans/new',
      };
    }

    if (hasPhotoRetake) {
      return {
        icon: '📷',
        title: 'Live photo retake required',
        description: `Credit Officer Remark: "${primaryVerifSummary?.selfie_details?.rejection_reason || 'Please submit a clearer photo with your face fully visible.'}"`,
        ctaLabel: 'Retake Photo Now →',
        ctaPath: `/loans/${primaryApp.id}?step=photo&mode=retake`,
        isUrgent: true,
      };
    }

    if (hasKycReplacement) {
      return {
        icon: '⚠️',
        title: 'KYC identity document replacement required',
        description: 'Your uploaded ID document could not be verified. Please upload a clear uncropped original PDF document.',
        ctaLabel: 'Replace Document Now →',
        ctaPath: `/loans/${primaryApp.id}?step=kyc`,
        isUrgent: true,
      };
    }

    switch (primaryApp.status) {
      case 'DRAFT':
        return {
          icon: '📝',
          title: 'Complete your loan application details',
          description: 'Provide your income and employment details to assess your loan eligibility limit.',
          ctaLabel: 'Continue Application →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'SUBMITTED':
        return {
          icon: '⚡',
          title: 'Run instant credit assessment',
          description: 'Your application is ready. Run automated credit assessment to view your tailored loan offers.',
          ctaLabel: 'Run Eligibility Check →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'ELIGIBILITY_CHECKED':
        return {
          icon: '🎁',
          title: 'Choose your repayment plan',
          description: 'Pre-approved offers are generated. Select your preferred tenure and monthly EMI.',
          ctaLabel: 'Select Loan Offer →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'OFFER_SELECTED':
      case 'BANK_ACCOUNT_ADDED':
      case 'DECLARATION_SIGNED':
      case 'SELFIE_UPLOADED':
        return {
          icon: '🔐',
          title: 'Complete identity & account verification',
          description: 'Your loan offer has been selected. Complete KYC document, bank penny drop, and live selfie to proceed to underwriting.',
          ctaLabel: 'Continue Verification →',
          ctaPath: `/loans/${primaryApp.id}?step=kyc`,
        };
      case 'UNDER_REVIEW':
        return {
          icon: '⏳',
          title: 'Application in underwriting review',
          description: 'Your verified application is currently being evaluated by our Credit Officers. Decision will be updated shortly.',
          ctaLabel: 'View Application Status →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'APPROVED':
        return {
          icon: '🎉',
          title: 'Loan approved & sanctioned',
          description: 'Congratulations! Your personal loan has been approved. Automated disbursement is ready.',
          ctaLabel: 'View Approval & Payout →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'DISBURSEMENT_PROCESSING':
        return {
          icon: '💸',
          title: 'Disbursement in progress',
          description: 'Funds are currently being transferred via IMPS/NEFT to your verified bank account.',
          ctaLabel: 'Track Bank Transfer →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      case 'DISBURSED':
        return {
          icon: '✓',
          title: 'Funds successfully disbursed',
          description: 'Loan amount has been credited to your bank account. View your repayment schedule and disbursement receipt.',
          ctaLabel: 'View Loan Summary →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
      default:
        return {
          icon: '📄',
          title: 'View active loan application',
          description: 'Track the real-time progress and details of your personal loan application.',
          ctaLabel: 'Open Application →',
          ctaPath: `/loans/${primaryApp.id}`,
        };
    }
  };

  const nextAction = getNextAction();
  const displayName = formatHeaderUserName(user?.email);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-[#B5652D]">
          <div className="animate-spin h-7 w-7 border-2 border-[#B5652D] border-t-transparent rounded-full" />
          <span className="text-[#14161A] font-medium text-sm">Opening Dashboard…</span>
        </div>
      </div>
    );
  }

  return (
    <CustomerLayout
      sidebarMode="workspace"
      primaryApplicationId={primaryApp?.id}
      status={primaryApp?.status}
      activeNav="dashboard"
    >
      <div className="w-full max-w-6xl mx-auto space-y-8 pb-14">
        {/* ========================================================================= */}
        {/* GREETING HEADER */}
        {/* ========================================================================= */}
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#14161A] font-editorial tracking-tight">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {displayName} 👋
          </h1>
          <p className="text-sm sm:text-base text-[#686D76]">
            {primaryApp
              ? "Here's the current status of your loan application."
              : "Welcome to EZFINANZ. Get instant digital personal loans with transparent terms."}
          </p>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-sm flex items-center gap-2.5 shadow-2xs">
            <span className="text-base">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {resendSuccess && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-sm flex items-center gap-2.5 font-medium shadow-2xs">
            <span className="text-base">✓</span>
            <span>{resendSuccess}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION A: CURRENT APPLICATION HERO CARD */}
        {/* ========================================================================= */}
        {primaryApp ? (
          <Card
            variant="default"
            padding="lg"
            className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-7 sm:p-8 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE7E1] pb-4 gap-3">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D] block">
                  CURRENT APPLICATION
                </span>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="font-mono font-bold text-lg sm:text-xl text-[#14161A]">
                    #{primaryApp.application_number}
                  </span>
                  <span className="text-sm text-[#8A8D93]">•</span>
                  <span className="text-sm sm:text-base font-semibold text-[#686D76]">
                    {primaryApp.purpose || 'Personal Expense'}
                  </span>
                </div>
              </div>
              <StatusBadge status={primaryApp.status} size="lg" />
            </div>

            {/* Key Numbers (Clean, Prominent & Highly Readable) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 pb-2">
              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]/80">
                <span className="text-xs font-semibold text-[#686D76] uppercase tracking-wider block">Requested Amount</span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-bold text-[#14161A] block mt-1">
                  ₹{Number(primaryApp.requested_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]/80">
                <span className="text-xs font-semibold text-[#686D76] uppercase tracking-wider block">Repayment Tenure</span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#14161A] block mt-1">
                  {primaryDisbursement?.tenure_months || primaryApp.requested_tenure_months || 24} Months
                </span>
              </div>

              <div className="p-4 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]/80">
                <span className="text-xs font-semibold text-[#686D76] uppercase tracking-wider block">Monthly EMI</span>
                <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-bold text-[#1E5C4A] block mt-1">
                  {primaryDisbursement?.emi
                    ? `₹${Number(primaryDisbursement.emi).toLocaleString('en-IN')}`
                    : 'Estimated on Offer'}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAE7E1] flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm text-[#8A8D93] gap-2">
              <span>
                Last updated {new Date(primaryApp.updated_at || primaryApp.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </span>
              <Link
                to={`/loans/${primaryApp.id}`}
                className="text-xs sm:text-sm font-bold text-[#B5652D] hover:underline flex items-center gap-1"
              >
                View Full Details →
              </Link>
            </div>
          </Card>
        ) : (
          /* Empty State */
          <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl text-center py-14 space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-3xl mx-auto">
              📝
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-xl font-bold text-[#14161A] font-editorial">
                You haven&apos;t started a loan application yet
              </h3>
              <p className="text-sm text-[#686D76]">
                Apply for a personal loan in a few simple steps with instant digital approval.
              </p>
            </div>
            <Link to="/loans/new">
              <Button variant="primary" size="lg" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white font-bold px-8">
                Apply for a Loan →
              </Button>
            </Link>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* SECTION B: NEXT ACTION (THE SINGLE PRIMARY CTA) */}
        {/* ========================================================================= */}
        {nextAction && (
          <div className="space-y-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#686D76] block">
              NEXT ACTION
            </span>

            <Card
              variant="default"
              padding="lg"
              className={`border shadow-xs rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 transition-all ${
                nextAction.isUrgent
                  ? 'bg-[#FAF3F2] border-[#8C3A32]/30 ring-1 ring-[#8C3A32]/20'
                  : 'bg-white border-[#E5E2DC]'
              }`}
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl mt-0.5">{nextAction.icon}</span>
                <div className="space-y-1">
                  <h3 className="text-base sm:text-lg font-bold text-[#14161A]">
                    {nextAction.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#686D76] leading-relaxed max-w-xl">
                    {nextAction.description}
                  </p>
                </div>
              </div>

              <div className="shrink-0 self-start sm:self-auto">
                {nextAction.ctaPath === '#resend-email' ? (
                  <Button
                    variant="primary"
                    size="md"
                    isLoading={resendingEmail}
                    onClick={handleResendEmail}
                    className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white font-bold py-3 px-6 text-sm"
                  >
                    {nextAction.ctaLabel}
                  </Button>
                ) : (
                  <Link to={nextAction.ctaPath}>
                    <Button
                      variant="primary"
                      size="md"
                      className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white font-bold py-3 px-6 text-sm"
                    >
                      {nextAction.ctaLabel}
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION C: COMPACT LOAN PROGRESS (HORIZONTAL STEPPER) */}
        {/* ========================================================================= */}
        {primaryApp && (
          <div className="space-y-2.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#686D76] block">
              LOAN PROGRESS
            </span>

            <Card
              variant="default"
              padding="md"
              className="bg-white border border-[#E5E2DC] shadow-xs rounded-2xl p-5 sm:p-6"
            >
              {/* Desktop Compact Progress Bar */}
              <div className="hidden sm:flex items-center justify-between gap-1 overflow-x-auto py-2">
                {LOAN_STAGES.map((st, index) => {
                  const state = getStageState(st.id, primaryApp.status, primaryVerifSummary);

                  const isDone = state === 'completed';
                  const isCurrent = state === 'current' || state === 'action_required';

                  return (
                    <React.Fragment key={st.id}>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isDone
                              ? 'bg-[#E8F2EE] text-[#1E5C4A] border border-[#C5E0D5]'
                              : isCurrent
                              ? 'bg-[#B5652D] text-white shadow-2xs ring-2 ring-[#B5652D]/20'
                              : 'bg-[#F7F5F1] text-[#8A8D93] border border-[#E5E2DC]'
                          }`}
                        >
                          {isDone ? '✓' : isCurrent ? '●' : '○'}
                        </span>
                        <span
                          className={`text-xs sm:text-sm ${
                            isCurrent
                              ? 'font-bold text-[#14161A]'
                              : isDone
                              ? 'font-semibold text-[#1E5C4A]'
                              : 'text-[#8A8D93]'
                          }`}
                        >
                          {st.title}
                        </span>
                      </div>

                      {index < LOAN_STAGES.length - 1 && (
                        <span className="text-[#C8C5BD] text-xs font-mono px-1">→</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Mobile Compact Progress Stack */}
              <div className="sm:hidden grid grid-cols-2 gap-2 text-xs">
                {LOAN_STAGES.map((st) => {
                  const state = getStageState(st.id, primaryApp.status, primaryVerifSummary);
                  const isDone = state === 'completed';
                  const isCurrent = state === 'current' || state === 'action_required';

                  return (
                    <div
                      key={st.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        isCurrent
                          ? 'bg-[#FAF3EE] border-[#F3D7C4] text-[#B5652D] font-bold'
                          : isDone
                          ? 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A] font-medium'
                          : 'bg-[#F7F5F1] border-[#E5E2DC] text-[#8A8D93]'
                      }`}
                    >
                      <span className="font-bold">{isDone ? '✓' : isCurrent ? '●' : '○'}</span>
                      <span className="truncate">{st.title}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* QUICK STATUS OVERVIEW WIDGETS (VERIFICATION & DOCUMENTS PREVIEW) */}
        {/* ========================================================================= */}
        {primaryApp && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Verification Widget */}
            <Card
              variant="default"
              padding="md"
              className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl">
                  🛡️
                </div>
                <div>
                  <span className="text-sm font-bold text-[#14161A] block">
                    Verification
                  </span>
                  <span className="text-xs text-[#686D76] block">
                    {verificationCompletedCount} of 4 steps completed
                  </span>
                </div>
              </div>
              <Link to="/verification">
                <Button variant="outline" size="sm" className="text-xs font-semibold py-2 px-3.5">
                  Review Verification →
                </Button>
              </Link>
            </Card>

            {/* Documents Widget */}
            <Card
              variant="default"
              padding="md"
              className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-xl">
                  📁
                </div>
                <div>
                  <span className="text-sm font-bold text-[#14161A] block">
                    Documents
                  </span>
                  <span className="text-xs text-[#686D76] block">
                    KYC ID & Live Selfie
                  </span>
                </div>
              </div>
              <Link to="/documents">
                <Button variant="outline" size="sm" className="text-xs font-semibold py-2 px-3.5">
                  View Documents →
                </Button>
              </Link>
            </Card>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION D: MY APPLICATIONS (COMPACT ROWS) */}
        {/* ========================================================================= */}
        {applications.length > 0 && (
          <div className="space-y-3" id="applications-section">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#686D76]">
                MY APPLICATIONS ({applications.length})
              </span>
              <Link to="/loans/new">
                <Button variant="outline" size="sm" className="text-xs font-semibold">
                  + New Application
                </Button>
              </Link>
            </div>

            <div className="space-y-2">
              {applications.map((app) => (
                <Card
                  key={app.id}
                  variant="default"
                  padding="md"
                  className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#D5D0C7] transition-all"
                >
                  <div className="flex items-center gap-3 sm:gap-6">
                    <span className="font-mono font-bold text-xs text-[#14161A]">
                      #{app.application_number}
                    </span>
                    <span className="text-xs text-[#686D76] font-medium hidden sm:inline-block">
                      {app.purpose || 'Personal Loan'}
                    </span>
                    <span className="font-mono font-bold text-xs text-[#14161A]">
                      ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')}
                    </span>
                    <StatusBadge status={app.status} size="sm" />
                  </div>

                  <div className="self-end sm:self-auto">
                    <Link to={`/loans/${app.id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        Open →
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

export default Dashboard;
