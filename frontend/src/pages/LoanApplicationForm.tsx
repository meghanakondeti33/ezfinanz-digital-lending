import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  checkEligibility,
  createApplication,
  fetchApplication,
  fetchOffers,
  selectOffer,
  submitApplication,
  updateDraft,
} from '../lib/loans-api';
import { fetchCustomerDisbursement } from '../lib/disbursement-api';
import type {
  EligibilityCheck,
  LoanApplication,
  LoanApplicationPayload,
  LoanOffer,
} from '../types/loan';
import type { DisbursementDetail } from '../types/disbursement';
import { VerificationWizard } from '../components/verification/VerificationWizard';
import { extractErrorMessage } from '../lib/error-utils';
import { Navbar } from '../components/navigation/Navbar';
import { LedgerLine } from '../components/journey/LedgerLine';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { StatusBadge } from '../components/ui/StatusBadge';

const PURPOSE_OPTIONS = [
  'Home renovation',
  'Medical expenses',
  'Education / Higher studies',
  'Debt consolidation',
  'Business expansion',
  'Wedding & family functions',
  'Travel & vacation',
  'Vehicle purchase',
  'Other personal needs',
];

const TENURE_OPTIONS = [6, 12, 18, 24, 36, 48, 60];

const EMPLOYMENT_OPTIONS = [
  { value: 'SALARIED', label: 'Salaried Professional' },
  { value: 'SELF_EMPLOYED', label: 'Self-Employed Professional' },
  { value: 'BUSINESS', label: 'Business Owner' },
  { value: 'OTHER', label: 'Other' },
];

export const LoanApplicationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityCheck | null>(null);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [disbursement, setDisbursement] = useState<DisbursementDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [selectingOfferId, setSelectingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('Home renovation');
  const [customPurpose, setCustomPurpose] = useState<string>('');
  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [employmentType, setEmploymentType] = useState<string>('SALARIED');
  const [employerName, setEmployerName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('');
  const [existingDebt, setExistingDebt] = useState<string>('0');
  const [requestedTenureMonths, setRequestedTenureMonths] = useState<number>(36);

  useEffect(() => {
    if (!isNew && id) {
      loadApplication(id);
    }
  }, [id, isNew]);

  const loadApplication = async (appId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApplication(appId);
      setApplication(data);

      // Populate form fields
      setRequestedAmount(data.requested_amount ? String(data.requested_amount) : '');
      if (data.purpose) {
        if (PURPOSE_OPTIONS.includes(data.purpose)) {
          setPurpose(data.purpose);
        } else {
          setPurpose('Other personal needs');
          setCustomPurpose(data.purpose);
        }
      }
      setMonthlyIncome(data.monthly_income ? String(data.monthly_income) : '');
      setEmploymentType(data.employment_type || 'SALARIED');
      setEmployerName(data.employer_name || '');
      setDesignation(data.designation || '');
      setExistingDebt(data.existing_debt ? String(data.existing_debt) : '0');
      setRequestedTenureMonths(data.requested_tenure_months || 36);

      // If application has moved past submitted, fetch offers
      if (data.status === 'ELIGIBILITY_CHECKED' || data.status === 'OFFER_SELECTED' || data.status === 'UNDER_REVIEW' || data.status === 'APPROVED' || data.status === 'DISBURSEMENT_PROCESSING' || data.status === 'DISBURSED') {
        loadOffers(appId);
      }

      // If application is approved or in disbursement lifecycle, fetch disbursement details
      if (
        data.status === 'APPROVED' ||
        data.status === 'DISBURSEMENT_PROCESSING' ||
        data.status === 'DISBURSED'
      ) {
        try {
          const disb = await fetchCustomerDisbursement(appId);
          setDisbursement(disb);
        } catch {
          // Non-critical
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load loan application.'));
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async (appId: string) => {
    try {
      const data = await fetchOffers(appId);
      setOffers(data.offers);
    } catch {
      // Non-critical if no offers yet
    }
  };

  const getFormData = (): LoanApplicationPayload => {
    const finalPurpose =
      purpose === 'Other personal needs' && customPurpose.trim()
        ? customPurpose.trim()
        : purpose;

    return {
      requested_amount: requestedAmount ? parseFloat(requestedAmount) : null,
      purpose: finalPurpose || null,
      monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : null,
      employment_type: employmentType || null,
      employer_name: employerName.trim() || null,
      designation: designation.trim() || null,
      existing_debt: existingDebt ? parseFloat(existingDebt) : 0,
      requested_tenure_months: requestedTenureMonths || null,
    };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    const payload = getFormData();

    try {
      if (isNew) {
        const created = await createApplication(payload);
        setApplication(created);
        setSuccessMessage('Draft application saved. You can return at any time.');
        navigate(`/loans/${created.id}`, { replace: true });
      } else if (application) {
        const updated = await updateDraft(application.id, payload);
        setApplication(updated);
        setSuccessMessage('Draft application updated successfully.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save draft.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const payload = getFormData();

    try {
      let currentAppId = application?.id;

      if (isNew || !currentAppId) {
        const created = await createApplication(payload);
        currentAppId = created.id;
        setApplication(created);
      } else {
        const updated = await updateDraft(currentAppId, payload);
        setApplication(updated);
      }

      const submitted = await submitApplication(currentAppId);
      setApplication(submitted);
      setSuccessMessage('Application submitted. Check your borrowing eligibility below.');
      navigate(`/loans/${submitted.id}`, { replace: true });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to submit application. Please check required fields.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckEligibility = async () => {
    if (!application) return;
    setEvaluating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const checkResult = await checkEligibility(application.id);
      setEligibility(checkResult);

      const updatedApp = await fetchApplication(application.id);
      setApplication(updatedApp);

      if (checkResult.status === 'ELIGIBLE') {
        setSuccessMessage('Great news! Your application passed credit assessment.');
        await loadOffers(application.id);
      } else {
        setError('Application is not eligible based on standard criteria. See details below.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to evaluate loan eligibility.'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleSelectOffer = async (offerId: string) => {
    if (!application) return;
    setSelectingOfferId(offerId);
    setError(null);
    setSuccessMessage(null);

    try {
      await selectOffer(application.id, offerId);
      setSuccessMessage('Repayment plan confirmed. Please complete the quick verification steps below.');

      const updatedApp = await fetchApplication(application.id);
      setApplication(updatedApp);
      await loadOffers(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to select loan offer.'));
    } finally {
      setSelectingOfferId(null);
    }
  };

  const isSubmittedOrHigher =
    application?.status !== undefined &&
    application?.status !== 'DRAFT';

  const isApprovedOrBeyond =
    application?.status === 'APPROVED' ||
    application?.status === 'DISBURSEMENT_PROCESSING' ||
    application?.status === 'DISBURSED';

  const isUnderReviewOrBeyond =
    application?.status === 'UNDER_REVIEW' ||
    isApprovedOrBeyond;

  const selectedOffer = offers.find((o) => o.status === 'SELECTED') || offers[0];
  const selectedTerm = selectedOffer?.terms && selectedOffer.terms[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-[#B5652D]">
          <div className="animate-spin h-7 w-7 border-2 border-[#B5652D] border-t-transparent rounded-full" />
          <span className="text-[#14161A] font-medium text-base">Opening your application…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Top Breadcrumb & Reference Header */}
        <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-4">
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-[#686D76] hover:text-[#14161A] transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <span className="text-sm font-mono font-bold text-[#14161A]">
            {application ? `#${application.application_number}` : 'New Loan Application'}
          </span>
        </div>

        {/* The Signature Ledger Line Tracker */}
        <LedgerLine status={application?.status} />

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-sm flex items-center gap-2.5">
            <span className="text-base">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-sm flex items-center gap-2.5 font-medium">
            <span className="text-base">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. APPROVAL / DISBURSEMENT MILESTONE */}
        {isApprovedOrBeyond && disbursement && (
          <Card variant="elevated" padding="lg" className="border-t-4 border-t-[#1E5C4A] space-y-6 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#E5E2DC] pb-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E5C4A]">
                  Disbursement Milestone
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
                  {application?.status === 'DISBURSED'
                    ? 'Your loan has been disbursed'
                    : 'Your loan has been approved'}
                </h2>
                <p className="text-sm text-[#686D76] mt-0.5">
                  {application?.status === 'DISBURSED'
                    ? 'Settlement completed to your verified destination bank account.'
                    : 'Credit authorization confirmed. Electronic payout processing is underway.'}
                </p>
              </div>

              <StatusBadge status={application?.status || 'APPROVED'} size="lg" />
            </div>

            {/* Financial Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#F7F5F1] border border-[#E5E2DC]">
                <span className="text-xs font-semibold text-[#686D76] uppercase block">Approved Principal</span>
                <span className="font-mono text-xl font-bold text-[#14161A] block mt-1">
                  ₹{Number(disbursement.approved_amount).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F5F1] border border-[#E5E2DC]">
                <span className="text-xs font-semibold text-[#686D76] uppercase block">Net Payout to Bank</span>
                <span className="font-mono text-xl font-bold text-[#1E5C4A] block mt-1">
                  ₹{Number(disbursement.net_disbursement_amount).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F5F1] border border-[#E5E2DC]">
                <span className="text-xs font-semibold text-[#686D76] uppercase block">Monthly EMI</span>
                <span className="font-mono text-xl font-bold text-[#14161A] block mt-1">
                  ₹{disbursement.emi ? Number(disbursement.emi).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-[#F7F5F1] border border-[#E5E2DC]">
                <span className="text-xs font-semibold text-[#686D76] uppercase block">Tenure & Rate</span>
                <span className="font-mono text-sm font-bold text-[#14161A] block mt-1">
                  {disbursement.tenure_months}M @ {Number(disbursement.interest_rate).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Destination Bank & Settlement Record */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
              <div className="p-4 rounded-xl bg-white border border-[#E5E2DC] space-y-2">
                <span className="font-bold text-[#14161A] block text-xs uppercase tracking-wider">
                  Destination Bank Account
                </span>
                <div className="space-y-1.5 text-[#686D76]">
                  <div className="flex justify-between">
                    <span>Bank:</span>
                    <strong className="text-[#14161A]">{disbursement.destination_bank_name || 'Verified Bank'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Account:</span>
                    <strong className="text-[#14161A] font-mono">*******{disbursement.destination_account_last4 || '****'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>IFSC Code:</span>
                    <strong className="text-[#14161A] font-mono">{disbursement.destination_ifsc || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E2DC] space-y-2">
                <span className="font-bold text-[#14161A] block text-xs uppercase tracking-wider">
                  Settlement Transaction Record
                </span>
                <div className="space-y-1.5 text-[#686D76]">
                  <div className="flex justify-between">
                    <span>Disbursement Reference:</span>
                    <strong className="text-[#B5652D] font-mono font-bold">{disbursement.disbursement_reference || 'In Progress'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Repayment:</span>
                    <strong className="text-[#14161A] font-mono">₹{disbursement.total_repayment ? Number(disbursement.total_repayment).toLocaleString('en-IN') : 'N/A'}</strong>
                  </div>
                  {disbursement.completed_at && (
                    <div className="flex justify-between border-t border-[#E5E2DC] pt-1.5">
                      <span>Completed:</span>
                      <strong className="text-[#1E5C4A]">{new Date(disbursement.completed_at).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* 2. ELIGIBILITY RESULT & TRANSPARENT REASONING */}
        {application?.status === 'ELIGIBILITY_CHECKED' && (
          <Card variant="elevated" padding="lg" className="border-t-4 border-t-[#B5652D] space-y-6 bg-white">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#E5E2DC] pb-4">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E5C4A]">
                  Assessment Complete
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
                  You&apos;re eligible for a personal loan
                </h2>
                <p className="text-sm text-[#686D76] mt-0.5">
                  Instant credit score: <strong className="text-[#14161A]">{eligibility?.score || '90'}/100</strong>. No hard credit inquiry was performed.
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs font-semibold text-[#686D76] uppercase block">Eligible Loan Amount</span>
                <span className="text-2xl sm:text-3xl font-bold text-[#B5652D] font-mono">
                  ₹{Number(application.requested_amount || 500000).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Why you're eligible — Transparent Reasoning Box */}
            <div className="p-5 rounded-xl bg-[#F7F5F1] border border-[#E5E2DC] space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#14161A]">
                Why you qualify
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#686D76]">
                <div className="flex items-start gap-2">
                  <span className="text-[#1E5C4A] font-bold">✓</span>
                  <span>Monthly income meets minimum threshold for requested principal.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#1E5C4A] font-bold">✓</span>
                  <span>Debt-to-income (DTI) ratio is within safe regulatory limits.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#1E5C4A] font-bold">✓</span>
                  <span>Employment stability criteria verified for requested tenure.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[#1E5C4A] font-bold">✓</span>
                  <span>Instant eligibility decision locked and ready for offer selection.</span>
                </div>
              </div>
            </div>

            {/* Action trigger for offers */}
            {offers.length === 0 && (
              <div className="flex justify-end">
                <Button variant="primary" size="lg" onClick={() => loadOffers(application.id)}>
                  View Personalized Loan Offers →
                </Button>
              </div>
            )}
          </Card>
        )}

        {/* 3. LOAN OFFER COMPARISON EXPLORER (When selecting offer) */}
        {application?.status === 'ELIGIBILITY_CHECKED' && offers.length > 0 && (
          <Card variant="elevated" padding="lg" className="space-y-6 bg-white">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                Trade-off Explorer
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
                Compare Your Personalized Loan Offers
              </h2>
              <p className="text-sm text-[#686D76] mt-0.5">
                Understand the trade-off between lower monthly EMI, shorter tenure, and total repayment cost.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {offers.map((offer, idx) => {
                const term = offer.terms && offer.terms[0];
                const isSelected = offer.status === 'SELECTED';
                const isRecommended = idx === 1 || offers.length === 1;

                return (
                  <div
                    key={offer.id}
                    className={`rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between border ${
                      isSelected
                        ? 'bg-[#F9F3EE] border-[#B5652D] ring-2 ring-[#B5652D]/20 shadow-md'
                        : isRecommended
                        ? 'bg-white border-[#B5652D]/50 shadow-sm'
                        : 'bg-white border-[#E5E2DC] hover:border-[#D4D0C7]'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Badge / Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#14161A] uppercase tracking-wider">
                          Plan {idx + 1}
                        </span>
                        {isRecommended && !isSelected && (
                          <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] bg-[#F9F3EE] border border-[#ECCBB3] px-2.5 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-xs font-bold uppercase tracking-wider text-[#1E5C4A] bg-[#E8F2EE] border border-[#C5E0D5] px-2.5 py-0.5 rounded-full">
                            ✓ Selected
                          </span>
                        )}
                      </div>

                      {/* Primary EMI metric */}
                      <div>
                        <span className="text-xs text-[#686D76] uppercase font-semibold block">Monthly EMI</span>
                        <span className="text-3xl font-black text-[#14161A] font-mono mt-1 block">
                          ₹{term ? Number(term.emi).toLocaleString('en-IN') : '0'}
                        </span>
                      </div>

                      {/* Term Metrics */}
                      <div className="space-y-2 text-sm border-t border-[#E5E2DC] pt-3 text-[#686D76]">
                        <div className="flex justify-between">
                          <span>Tenure:</span>
                          <strong className="text-[#14161A]">{term ? `${term.tenure_months} Months` : 'N/A'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Interest Rate:</span>
                          <strong className="text-[#14161A] font-mono">{Number(offer.interest_rate).toFixed(2)}% p.a.</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Net Payout:</span>
                          <strong className="text-[#1E5C4A] font-mono">₹{term ? Number(term.net_disbursement).toLocaleString('en-IN') : '0'}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Repayment:</span>
                          <strong className="text-[#14161A] font-mono">₹{term ? Number(term.total_repayment).toLocaleString('en-IN') : '0'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 mt-4 border-t border-[#E5E2DC]">
                      <Button
                        variant={isSelected ? 'secondary' : 'primary'}
                        size="md"
                        className="w-full"
                        disabled={isSelected || selectingOfferId !== null || isApprovedOrBeyond}
                        isLoading={selectingOfferId === offer.id}
                        onClick={() => handleSelectOffer(offer.id)}
                      >
                        {isSelected ? '✓ Plan Confirmed' : 'Select This Plan →'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 4. VERIFICATION PIPELINE (When Offer Selected and verifying) */}
        {application && application.status === 'OFFER_SELECTED' && (
          <VerificationWizard
            applicationId={application.id}
            onVerificationComplete={async () => {
              const updated = await fetchApplication(application.id);
              setApplication(updated);
            }}
          />
        )}

        {/* 5. CUSTOMER LOAN REVIEW DOSSIER (When Under Review, Approved, or Disbursed) */}
        {isUnderReviewOrBeyond && application && (
          <div className="space-y-6">
            {/* Section A: YOUR SELECTED LOAN (Requirement 4) */}
            <Card variant="elevated" padding="lg" className="border-l-4 border-l-[#B5652D] bg-white space-y-5">
              <div className="border-b border-[#E5E2DC] pb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                  Confirmed Repayment Plan
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
                  YOUR SELECTED LOAN
                </h2>
                <p className="text-sm text-[#686D76] mt-0.5">
                  The terms and monthly commitment confirmed for this personal loan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="p-4 bg-[#F9F3EE] rounded-xl border border-[#ECCBB3] md:col-span-2">
                  <span className="text-xs text-[#9C4F1C] font-semibold uppercase block">Monthly EMI</span>
                  <span className="font-mono font-bold text-3xl text-[#14161A] block mt-1">
                    {disbursement?.emi
                      ? `₹${Number(disbursement.emi).toLocaleString('en-IN')}`
                      : selectedTerm
                      ? `₹${Number(selectedTerm.emi).toLocaleString('en-IN')}`
                      : 'Calculated'}
                  </span>
                  <span className="text-xs text-[#686D76] mt-1 block">Fixed monthly repayment</span>
                </div>

                <div className="p-4 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                  <span className="text-xs text-[#686D76] font-semibold uppercase block">Loan Amount</span>
                  <span className="font-mono font-bold text-xl text-[#14161A] block mt-1">
                    ₹{Number(application.requested_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-4 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                  <span className="text-xs text-[#686D76] font-semibold uppercase block">Repayment Period</span>
                  <span className="font-bold text-lg text-[#14161A] block mt-1">
                    {disbursement?.tenure_months || selectedTerm?.tenure_months || application.requested_tenure_months || 36} Months
                  </span>
                </div>

                <div className="p-4 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                  <span className="text-xs text-[#686D76] font-semibold uppercase block">Interest Rate</span>
                  <span className="font-mono font-bold text-lg text-[#14161A] block mt-1">
                    {disbursement?.interest_rate
                      ? `${Number(disbursement.interest_rate).toFixed(2)}% p.a.`
                      : selectedOffer
                      ? `${Number(selectedOffer.interest_rate).toFixed(2)}% p.a.`
                      : '12.00% p.a.'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-[#E8F2EE] rounded-xl border border-[#C5E0D5] flex items-center justify-between text-sm">
                <span className="font-semibold text-[#1E5C4A]">Amount you&apos;ll receive in bank:</span>
                <span className="font-mono font-bold text-lg text-[#1E5C4A]">
                  ₹{disbursement?.net_disbursement_amount
                    ? Number(disbursement.net_disbursement_amount).toLocaleString('en-IN')
                    : selectedTerm
                    ? Number(selectedTerm.net_disbursement).toLocaleString('en-IN')
                    : Number(application.requested_amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </Card>

            {/* Section B: YOUR LOAN DETAILS (Requirement 3) */}
            <Card variant="default" padding="lg" className="bg-white space-y-4">
              <div className="border-b border-[#E5E2DC] pb-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#686D76]">
                  Borrower Summary
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#14161A] font-editorial mt-1">
                  YOUR LOAN DETAILS
                </h3>
                <p className="text-sm text-[#686D76] mt-0.5">
                  Here&apos;s a summary of the information you provided.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs text-[#686D76] block">Loan amount</span>
                  <strong className="text-[#14161A] font-mono text-base block mt-0.5">
                    ₹{Number(application.requested_amount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div>
                  <span className="text-xs text-[#686D76] block">Monthly income</span>
                  <strong className="text-[#14161A] font-mono text-base block mt-0.5">
                    ₹{Number(application.monthly_income || 0).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div>
                  <span className="text-xs text-[#686D76] block">Existing monthly commitments</span>
                  <strong className="text-[#14161A] font-mono text-base block mt-0.5">
                    ₹{Number(application.existing_debt || 0).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div>
                  <span className="text-xs text-[#686D76] block">Employment</span>
                  <strong className="text-[#14161A] block mt-0.5">
                    {application.employment_type === 'SALARIED'
                      ? 'Salaried Professional'
                      : application.employment_type === 'SELF_EMPLOYED'
                      ? 'Self-Employed'
                      : application.employment_type || 'Professional'}
                  </strong>
                </div>

                <div>
                  <span className="text-xs text-[#686D76] block">Employer</span>
                  <strong className="text-[#14161A] block mt-0.5">{application.employer_name || 'N/A'}</strong>
                </div>

                <div>
                  <span className="text-xs text-[#686D76] block">Loan purpose</span>
                  <strong className="text-[#14161A] block mt-0.5">{application.purpose || 'Personal needs'}</strong>
                </div>
              </div>
            </Card>

            {/* Section C: YOUR VERIFICATION & APPLICATION UPDATES (Requirements 1 & 2) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* YOUR VERIFICATION (Requirement 2) */}
              <Card variant="default" padding="lg" className="bg-white space-y-4">
                <div className="border-b border-[#E5E2DC] pb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#1E5C4A]">
                    Completed Checks
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#14161A] font-editorial mt-1">
                    YOUR VERIFICATION
                  </h3>
                  <p className="text-xs text-[#686D76] mt-0.5">
                    All required checks have been completed.
                  </p>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                    <span className="font-semibold text-[#14161A]">Identity verified</span>
                    <span className="text-[#1E5C4A] font-bold">✓ Complete</span>
                  </div>

                  <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                    <span className="font-semibold text-[#14161A]">Bank account verified</span>
                    <span className="text-[#1E5C4A] font-bold">✓ Complete</span>
                  </div>

                  <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                    <span className="font-semibold text-[#14161A]">Photo verification completed</span>
                    <span className="text-[#1E5C4A] font-bold">✓ Complete</span>
                  </div>

                  <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                    <span className="font-semibold text-[#14161A]">Declaration accepted</span>
                    <span className="text-[#1E5C4A] font-bold">✓ Complete</span>
                  </div>
                </div>
              </Card>

              {/* APPLICATION UPDATES (Requirement 1 - Replaces Technical Audit Trail) */}
              <Card variant="default" padding="lg" className="bg-white space-y-4">
                <div className="border-b border-[#E5E2DC] pb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                    Journey Milestones
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#14161A] font-editorial mt-1">
                    Application updates
                  </h3>
                  <p className="text-xs text-[#686D76] mt-0.5">
                    Live record of your loan progress.
                  </p>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                    <div>
                      <strong className="text-[#14161A] block">Application submitted</strong>
                      <span className="text-xs text-[#686D76]">Your loan intake details were received.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                    <div>
                      <strong className="text-[#14161A] block">Eligibility confirmed</strong>
                      <span className="text-xs text-[#686D76]">Borrowing limit evaluated and approved.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                    <div>
                      <strong className="text-[#14161A] block">Offer selected</strong>
                      <span className="text-xs text-[#686D76]">Repayment tenure and monthly EMI locked.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                    <div>
                      <strong className="text-[#14161A] block">Verification completed</strong>
                      <span className="text-xs text-[#686D76]">Identity and bank account verified.</span>
                    </div>
                  </div>

                  {isApprovedOrBeyond && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                      <div>
                        <strong className="text-[#14161A] block">Loan approved</strong>
                        <span className="text-xs text-[#686D76]">Credit officer authorized fund payout.</span>
                      </div>
                    </div>
                  )}

                  {(application.status === 'DISBURSEMENT_PROCESSING' || application.status === 'DISBURSED') && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                      <div>
                        <strong className="text-[#14161A] block">Disbursement initiated</strong>
                        <span className="text-xs text-[#686D76]">Electronic transfer sent to your bank.</span>
                      </div>
                    </div>
                  )}

                  {application.status === 'DISBURSED' && (
                    <div className="flex items-start gap-2.5">
                      <span className="text-[#1E5C4A] font-bold text-base mt-0.5">✓</span>
                      <div>
                        <strong className="text-[#1E5C4A] block">Funds transferred to bank</strong>
                        <span className="text-xs text-[#686D76]">Settlement completed successfully.</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* 6. LOAN APPLICATION GUIDED FORM (When still Draft or Submitted) */}
        {(!application || application.status === 'DRAFT' || application.status === 'SUBMITTED') && (
          <Card variant="default" padding="lg" className="space-y-6 bg-white">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                Guided Application
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
                {isSubmittedOrHigher ? 'Application Summary' : 'Personal Loan Details'}
              </h1>
              <p className="text-sm text-[#686D76] mt-0.5">
                {isSubmittedOrHigher
                  ? 'Your application details have been submitted. Run eligibility evaluation below.'
                  : 'Answer these three simple questions to receive instant loan eligibility.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Theme 1: Loan Requirement */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-[#14161A] uppercase tracking-wider border-b border-[#E5E2DC] pb-2">
                  1. How much would you like to borrow?
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Requested Amount (₹)"
                    type="number"
                    required
                    min={10000}
                    max={5000000}
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    hint="₹10,000 to ₹50,00,000"
                    disabled={isSubmittedOrHigher}
                  />

                  <Select
                    label="Preferred Tenure"
                    options={TENURE_OPTIONS.map((t) => ({ value: t, label: `${t} Months (${t / 12} Years)` }))}
                    value={requestedTenureMonths}
                    onChange={(e) => setRequestedTenureMonths(Number(e.target.value))}
                    hint="Repayment duration"
                    disabled={isSubmittedOrHigher}
                  />
                </div>

                <Select
                  label="What will you use the loan for?"
                  options={PURPOSE_OPTIONS.map((p) => ({ value: p, label: p }))}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  disabled={isSubmittedOrHigher}
                />

                {purpose === 'Other personal needs' && (
                  <Input
                    label="Specify Loan Purpose"
                    value={customPurpose}
                    onChange={(e) => setCustomPurpose(e.target.value)}
                    placeholder="Briefly describe what you'll use the loan for"
                    disabled={isSubmittedOrHigher}
                  />
                )}
              </div>

              {/* Theme 2: Income & Employment */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-[#14161A] uppercase tracking-wider border-b border-[#E5E2DC] pb-2">
                  2. Income & Employment Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Employment Type"
                    options={EMPLOYMENT_OPTIONS}
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    disabled={isSubmittedOrHigher}
                  />

                  <Input
                    label="What's your net monthly income? (₹)"
                    type="number"
                    required
                    min={5000}
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="e.g. 75000"
                    hint="After-tax take home"
                    disabled={isSubmittedOrHigher}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Where do you work?"
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    placeholder="Company or practice name"
                    hint="Used to verify income stability"
                    disabled={isSubmittedOrHigher}
                  />

                  <Input
                    label="Designation / Role"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Software Engineer"
                    disabled={isSubmittedOrHigher}
                  />
                </div>
              </div>

              {/* Theme 3: Existing Obligations */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-[#14161A] uppercase tracking-wider border-b border-[#E5E2DC] pb-2">
                  3. What do you currently pay toward other loans?
                </h2>

                <Input
                  label="Total Existing Monthly EMIs (₹)"
                  type="number"
                  min={0}
                  value={existingDebt}
                  onChange={(e) => setExistingDebt(e.target.value)}
                  placeholder="0 if none"
                  hint="Used to calculate your safe debt-to-income (DTI) ratio"
                  disabled={isSubmittedOrHigher}
                />
              </div>

              {/* Form Action Controls */}
              {!isSubmittedOrHigher ? (
                <div className="pt-4 border-t border-[#E5E2DC] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-sm text-[#686D76]">
                    You can pause here — your draft is safely saved.
                  </span>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      className="flex-1 sm:flex-none"
                      isLoading={saving}
                      onClick={handleSaveDraft}
                    >
                      Save Draft
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      className="flex-1 sm:flex-none"
                      isLoading={submitting}
                    >
                      Submit Loan Application →
                    </Button>
                  </div>
                </div>
              ) : application?.status === 'SUBMITTED' ? (
                <div className="pt-4 border-t border-[#E5E2DC] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-sm text-[#686D76]">
                    Application submitted. Assess your borrowing capacity now.
                  </span>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    isLoading={evaluating}
                    onClick={handleCheckEligibility}
                  >
                    Check Loan Eligibility →
                  </Button>
                </div>
              ) : null}
            </form>
          </Card>
        )}
      </main>
    </div>
  );
};

export default LoanApplicationForm;
