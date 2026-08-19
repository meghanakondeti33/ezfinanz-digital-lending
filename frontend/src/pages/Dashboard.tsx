import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApplications } from '../lib/loans-api';
import { fetchCustomerDisbursement } from '../lib/disbursement-api';
import { fetchVerificationSummary, fetchKYC } from '../lib/verification-api';
import type { LoanApplication } from '../types/loan';
import type { DisbursementDetail } from '../types/disbursement';
import type { VerificationSummary } from '../types/verification';
import { extractErrorMessage } from '../lib/error-utils';
import apiClient from '../lib/api-client';
import { Navbar } from '../components/navigation/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { LedgerLine } from '../components/journey/LedgerLine';

export const formatUserDisplayName = (email?: string, kycName?: string | null): string => {
  if (kycName && kycName.trim()) {
    return kycName.trim();
  }
  if (!email) return 'Customer';

  const userPart = email.split('@')[0];
  if (userPart.toLowerCase() === 'admin') return 'Admin';
  if (userPart.toLowerCase() === 'customer') return 'Customer';

  // Extract name tokens from email (e.g. kondetimeghana77 -> Meghana Kondeti)
  const noNumbers = userPart.replace(/[0-9]/g, '');
  if (!noNumbers) return userPart;

  // If separated by dots, underscores, hyphens
  if (/[._\-]/.test(noNumbers)) {
    return noNumbers
      .split(/[._\-]/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle common concatenated names like kondetimeghana
  if (noNumbers.toLowerCase().includes('meghana')) {
    return 'Meghana Kondeti';
  }

  // Fallback: Capitalize first letter
  return noNumbers.charAt(0).toUpperCase() + noNumbers.slice(1).toLowerCase();
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [primaryDisbursement, setPrimaryDisbursement] = useState<DisbursementDetail | null>(null);
  const [primaryVerifSummary, setPrimaryVerifSummary] = useState<VerificationSummary | null>(null);
  const [appsLoading, setAppsLoading] = useState<boolean>(true);
  const [appsError, setAppsError] = useState<string | null>(null);

  // Email Verification Alert Banner State
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [emailResendCooldown, setEmailResendCooldown] = useState<number>(0);
  const [emailAlertMsg, setEmailAlertMsg] = useState<string | null>(null);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);

  useEffect(() => {
    let timer: any;
    if (emailResendCooldown > 0) {
      timer = setInterval(() => {
        setEmailResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [emailResendCooldown]);

  const handleResendVerificationEmail = async () => {
    if (emailResendCooldown > 0 || resendingEmail) return;
    try {
      setResendingEmail(true);
      setEmailAlertMsg(null);
      setDevVerifyUrl(null);
      const res = await apiClient.post('/auth/send-email-verification', { email: user?.email });
      setEmailAlertMsg(res.data.message || '✓ Verification email sent! Please check your inbox.');
      if (res.data.verify_url) {
        setDevVerifyUrl(res.data.verify_url);
      }
      setEmailResendCooldown(res.data.cooldown_seconds || 60);
    } catch (err: any) {
      setEmailAlertMsg(extractErrorMessage(err, 'Failed to send verification email.'));
    } finally {
      setResendingEmail(false);
    }
  };

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

      if (data.items.length > 0) {
        const topApp = data.items[0];
        try {
          const verif = await fetchVerificationSummary(topApp.id);
          setPrimaryVerifSummary(verif);
          if (verif.kyc === 'VERIFIED') {
            try {
              const k = await fetchKYC(topApp.id);
              if (k?.full_name) {
                setCustomerName(k.full_name);
              }
            } catch {}
          }
        } catch {
          // Non-critical if verification summary fails
        }

        if (
          topApp.status === 'APPROVED' ||
          topApp.status === 'DISBURSEMENT_PROCESSING' ||
          topApp.status === 'DISBURSED'
        ) {
          try {
            const disb = await fetchCustomerDisbursement(topApp.id);
            setPrimaryDisbursement(disb);
          } catch {
            // Non-critical
          }
        }
      }
    } catch (err: any) {
      setAppsError(extractErrorMessage(err, 'Failed to load your loan applications. Please refresh.'));
    } finally {
      setAppsLoading(false);
    }
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const isAdmin = user?.role === 'ADMIN';

  const primaryApp = applications.length > 0 ? applications[0] : null;

  const getNextActionText = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Continue application →';
      case 'SUBMITTED':
        return 'Check loan eligibility →';
      case 'ELIGIBILITY_CHECKED':
        return 'Choose your offer →';
      case 'OFFER_SELECTED':
        return 'Complete verification →';
      case 'UNDER_REVIEW':
        return 'View loan details →';
      case 'APPROVED':
      case 'DISBURSEMENT_PROCESSING':
      case 'DISBURSED':
      default:
        return 'View loan details →';
    }
  };

  const getStatusHeadline = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'Your application is ready to finish';
      case 'SUBMITTED':
        return 'Application submitted — ready for eligibility';
      case 'ELIGIBILITY_CHECKED':
        return "You're eligible — choose your repayment plan";
      case 'OFFER_SELECTED':
        return 'Plan selected — complete identity verification';
      case 'UNDER_REVIEW':
        return 'Your application is with our review team';
      case 'APPROVED':
        return 'Your loan has been approved';
      case 'DISBURSEMENT_PROCESSING':
        return 'Money is being transferred to your account';
      case 'DISBURSED':
        return 'Loan funds disbursed & settled';
      case 'REJECTED':
        return 'Application declined';
      default:
        return 'Personal Loan';
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-[#E5E2DC] pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
              Borrower Workspace
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#14161A] font-editorial tracking-tight mt-1">
              Your Loan Journey
            </h1>
            <p className="text-sm sm:text-base text-[#686D76] mt-1">
              Welcome back,{' '}
              <span className="font-semibold text-[#14161A]">
                {formatUserDisplayName(user?.email, customerName)}
              </span>
            </p>
          </div>

          {isCustomer && primaryApp && (
            <div>
              <Link to="/loans/new">
                <Button variant="outline" size="md">
                  + Apply for a new loan
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Credit Officer Quick Link if logged in as Admin */}
        {isAdmin && (
          <Card variant="accent" padding="md" className="bg-[#F9F3EE] border-[#ECCBB3]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#9C4F1C]">
                  Underwriter Portal
                </span>
                <h2 className="text-lg font-bold text-[#14161A] font-editorial">
                  Case Review & Underwriting Queue
                </h2>
                <p className="text-sm text-[#686D76] mt-0.5">
                  You are signed in with the Credit Officer role. Access the administrative case queue to review applications.
                </p>
              </div>
              <Link to="/admin" className="shrink-0">
                <Button variant="secondary" size="md">
                  Open Underwriting Queue →
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {/* CUSTOMER LOAN ZONE */}
        {isCustomer && (
          <div className="space-y-6">
            {/* Email Verification Banner if unverified */}
            {user && !user.email_verified && (
              <div className="p-5 bg-[#FDF6EC] border border-[#F3E1C5] rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">✉️</span>
                  <div className="space-y-1.5">
                    <span className="font-bold text-[#A8752B] text-base block font-editorial">
                      Email verification required
                    </span>
                    <p className="text-xs text-[#686D76] leading-relaxed">
                      We've sent a verification link to{' '}
                      <span className="font-semibold text-[#14161A]">{user.email}</span>.
                      <br />
                      Please check your inbox and click the link to verify your email address.
                    </p>
                    {emailAlertMsg && (
                      <span className="block text-xs font-semibold text-[#1E5C4A] bg-[#E8F3EE] px-2.5 py-1 rounded-md">
                        {emailAlertMsg}
                      </span>
                    )}
                    {devVerifyUrl && (
                      <div className="mt-2.5 p-3 bg-white border border-[#ECCBB3] rounded-xl text-xs space-y-1.5">
                        <span className="font-bold text-[#B5652D] uppercase tracking-wider text-[11px] block">
                          DEVELOPMENT MODE
                        </span>
                        <p className="text-[#686D76]">
                          Email delivery is disabled in mock mode. Use this verification link for local testing:
                        </p>
                        <a
                          href={devVerifyUrl}
                          className="inline-flex items-center gap-1 font-bold text-[#B5652D] hover:underline break-all"
                        >
                          🔗 Click here to verify email locally →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:items-end gap-1 shrink-0 pt-1">
                  <span className="text-[11px] text-[#8A8D93]">Didn't receive it?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emailResendCooldown > 0 || resendingEmail}
                    isLoading={resendingEmail}
                    onClick={handleResendVerificationEmail}
                    className="whitespace-nowrap"
                  >
                    {emailResendCooldown > 0
                      ? `Resend in ${emailResendCooldown}s`
                      : 'Resend verification email'}
                  </Button>
                </div>
              </div>
            )}

            {appsLoading ? (
              <Card padding="lg" className="text-center py-16">
                <div className="animate-spin h-7 w-7 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-sm text-[#686D76]">Retrieving your active loan application…</p>
              </Card>
            ) : appsError ? (
              <Card padding="md" className="border-[#8C3A32] bg-[#FBEFEC]">
                <p className="text-sm text-[#8C3A32] font-medium">⚠️ {appsError}</p>
              </Card>
            ) : applications.length === 0 ? (
              /* EMPTY STATE (Per Blueprint Section 9) */
              <div className="space-y-8">
                <Card variant="elevated" padding="lg" className="text-center py-12 sm:py-16 space-y-6 bg-white">
                  <div className="w-16 h-16 rounded-full bg-[#F9F3EE] border border-[#ECCBB3] flex items-center justify-center mx-auto text-2xl text-[#B5652D]">
                    ✦
                  </div>

                  <div className="max-w-xl mx-auto space-y-2">
                    <h2 className="text-3xl sm:text-4xl font-bold text-[#14161A] font-editorial tracking-tight">
                      Your loan journey starts here.
                    </h2>
                    <p className="text-sm sm:text-base text-[#686D76] leading-relaxed">
                      Apply online in a few simple steps and receive transparent terms with direct bank transfer upon approval.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Link to="/loans/new">
                      <Button variant="primary" size="lg" className="px-8 py-3 text-base">
                        Apply for a personal loan →
                      </Button>
                    </Link>
                  </div>
                </Card>

                {/* How It Works Explainer */}
                <div className="bg-white border border-[#E5E2DC] rounded-2xl p-6 sm:p-8 space-y-6">
                  <div className="border-b border-[#E5E2DC] pb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
                      Simple Process
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#14161A] font-editorial mt-1">
                      How it works
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                    <div className="p-4 rounded-xl bg-[#F7F5F1] space-y-1.5">
                      <span className="text-xs font-mono font-bold text-[#B5652D]">1</span>
                      <h4 className="text-sm font-bold text-[#14161A]">Apply</h4>
                      <p className="text-xs text-[#686D76]">Tell us how much you need and your basic details.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F7F5F1] space-y-1.5">
                      <span className="text-xs font-mono font-bold text-[#B5652D]">2</span>
                      <h4 className="text-sm font-bold text-[#14161A]">Check eligibility</h4>
                      <p className="text-xs text-[#686D76]">Get instant borrowing limit evaluation with clear reasons.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F7F5F1] space-y-1.5">
                      <span className="text-xs font-mono font-bold text-[#B5652D]">3</span>
                      <h4 className="text-sm font-bold text-[#14161A]">Compare offers</h4>
                      <p className="text-xs text-[#686D76]">Choose your preferred EMI and repayment schedule.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F7F5F1] space-y-1.5">
                      <span className="text-xs font-mono font-bold text-[#B5652D]">4</span>
                      <h4 className="text-sm font-bold text-[#14161A]">Verify your details</h4>
                      <p className="text-xs text-[#686D76]">Quick and secure identity and destination bank check.</p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#F7F5F1] space-y-1.5">
                      <span className="text-xs font-mono font-bold text-[#B5652D]">5</span>
                      <h4 className="text-sm font-bold text-[#14161A]">Receive your funds</h4>
                      <p className="text-xs text-[#686D76]">Electronic transfer directly into your verified bank account.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE OR COMPLETED LOAN SUMMARY */
              <div className="space-y-6">
                {primaryApp && (
                  <Card variant="elevated" padding="lg" className="space-y-6 border-t-4 border-t-[#B5652D] bg-white">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E5E2DC] pb-5">
                      <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span className="text-xs font-mono font-bold text-[#686D76]">
                            #{primaryApp.application_number}
                          </span>
                          <StatusBadge status={primaryApp.status} size="md" />
                        </div>

                        <span className="text-xs font-semibold text-[#686D76] uppercase tracking-wider block mt-1">
                          {getStatusHeadline(primaryApp.status)}
                        </span>

                        <h2 className="text-3xl sm:text-4xl font-bold text-[#14161A] font-mono mt-1">
                          ₹{Number(primaryApp.requested_amount || 0).toLocaleString('en-IN')}
                        </h2>

                        <p className="text-xs text-[#8A8D93] mt-1">
                          Updated on {new Date(primaryApp.updated_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                        </p>
                      </div>

                      <div className="self-start sm:self-auto">
                        <Link
                          to={
                            primaryVerifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED'
                              ? `/loans/${primaryApp.id}?step=photo&mode=retake`
                              : `/loans/${primaryApp.id}`
                          }
                        >
                          <Button variant="primary" size="lg" className="w-full sm:w-auto">
                            {primaryVerifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED'
                              ? '📸 Retake photo →'
                              : getNextActionText(primaryApp.status)}
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {/* LIVE PHOTO STATUS BANNERS */}
                    {primaryVerifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' && (
                      <div className="p-4 bg-[#FAF3F2] border-2 border-[#8C3A32] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">⚠️</span>
                          <div>
                            <span className="text-sm font-bold text-[#8C3A32] block">
                              Action required: Your live photo needs to be retaken
                            </span>
                            <p className="text-xs text-[#686D76] mt-0.5 leading-relaxed">
                              Reason: &ldquo;{primaryVerifSummary.selfie_details?.rejection_reason || 'Please submit a clearer photo with your face fully visible.'}&rdquo;
                            </p>
                          </div>
                        </div>
                        <Link
                          to={`/loans/${primaryApp.id}?step=photo&mode=retake`}
                          className="shrink-0"
                        >
                          <Button variant="danger" size="sm">
                            📸 Retake photo →
                          </Button>
                        </Link>
                      </div>
                    )}

                    {primaryVerifSummary?.selfie === 'PHOTO_PENDING_REVIEW' && (
                      <div className="p-4 bg-[#F9F3EE] border border-[#ECCBB3] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-white border border-[#ECCBB3] flex items-center justify-center font-bold text-[#B5652D]">
                            📷
                          </span>
                          <div>
                            <span className="font-bold text-[#14161A] block text-sm">
                              LIVE PHOTO: ✓ Photo submitted
                            </span>
                            <span className="text-[#686D76] mt-0.5 block">
                              Submitted on:{' '}
                              {primaryVerifSummary.selfie_details?.submitted_at
                                ? new Date(primaryVerifSummary.selfie_details.submitted_at).toLocaleDateString('en-IN')
                                : 'Recently'}{' '}
                              • Status: <strong className="text-[#B5652D]">Pending review</strong>
                            </span>
                          </div>
                        </div>
                        <Link to={`/loans/${primaryApp.id}`}>
                          <button type="button" className="text-xs font-semibold text-[#B5652D] hover:underline cursor-pointer">
                            View submitted photo →
                          </button>
                        </Link>
                      </div>
                    )}

                    {(primaryVerifSummary?.selfie === 'PHOTO_APPROVED' || primaryVerifSummary?.selfie === 'VERIFIED') && (
                      <div className="p-3 bg-[#E8F2EE] border border-[#C5E0D5] rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-[#1E5C4A] font-semibold">
                          <span>✓</span>
                          <span>Live photo verified & approved by credit team</span>
                        </div>
                        <span className="text-[11px] font-bold text-[#1E5C4A]">Approved</span>
                      </div>
                    )}

                    {/* Compact Financial Attributes Grid (Per Requirement 3) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                        <span className="text-[11px] text-[#686D76] font-semibold uppercase block">Loan Purpose</span>
                        <strong className="text-sm font-bold text-[#14161A] block mt-1">
                          {primaryApp.purpose || 'Personal needs'}
                        </strong>
                      </div>

                      <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                        <span className="text-[11px] text-[#686D76] font-semibold uppercase block">Selected Plan</span>
                        <strong className="text-sm font-bold text-[#14161A] block mt-1">
                          {primaryDisbursement?.tenure_months
                            ? `${primaryDisbursement.tenure_months} Months`
                            : primaryApp.requested_tenure_months
                            ? `${primaryApp.requested_tenure_months} Months`
                            : 'Pending selection'}
                        </strong>
                      </div>

                      <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                        <span className="text-[11px] text-[#686D76] font-semibold uppercase block">Monthly EMI</span>
                        <strong className="text-sm font-bold text-[#14161A] font-mono block mt-1">
                          {primaryDisbursement?.emi
                            ? `₹${Number(primaryDisbursement.emi).toLocaleString('en-IN')}`
                            : 'Pending'}
                        </strong>
                      </div>

                      <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                        <span className="text-[11px] text-[#686D76] font-semibold uppercase block">Interest Rate</span>
                        <strong className="text-sm font-bold text-[#14161A] font-mono block mt-1">
                          {primaryDisbursement?.interest_rate
                            ? `${Number(primaryDisbursement.interest_rate).toFixed(2)}% p.a.`
                            : '12.00% p.a.'}
                        </strong>
                      </div>
                    </div>

                    {/* Integrated Ledger Line */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-semibold text-[#686D76] uppercase tracking-wider block">
                        What&apos;s happening now
                      </span>
                      <LedgerLine status={primaryApp.status} compact />
                    </div>
                  </Card>
                )}

                {/* Additional Applications if user has more than 1 */}
                {applications.length > 1 && (
                  <div className="space-y-3 pt-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#686D76] font-mono">
                      Other Applications ({applications.length - 1})
                    </h3>
                    <div className="space-y-3">
                      {applications.slice(1).map((app) => (
                        <Card key={app.id} variant="default" padding="sm" className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="font-mono text-xs font-bold text-[#14161A] block">
                                #{app.application_number}
                              </span>
                              <span className="text-xs text-[#686D76]">
                                ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')} • {app.purpose || 'Personal'}
                              </span>
                            </div>
                            <StatusBadge status={app.status} size="sm" />
                          </div>

                          <Link to={`/loans/${app.id}`}>
                            <Button variant="outline" size="sm">
                              View loan details →
                            </Button>
                          </Link>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
