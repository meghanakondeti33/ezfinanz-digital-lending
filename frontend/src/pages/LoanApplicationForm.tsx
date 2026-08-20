import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
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
import { fetchVerificationSummary } from '../lib/verification-api';
import type {
  EligibilityCheck,
  LoanApplication,
  LoanApplicationPayload,
  LoanOffer,
} from '../types/loan';
import type { DisbursementDetail } from '../types/disbursement';
import type { VerificationSummary } from '../types/verification';
import { VerificationWizard } from '../components/verification/VerificationWizard';
import { extractErrorMessage } from '../lib/error-utils';
import { CustomerLayout } from '../components/layout/CustomerLayout';
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
  { value: 'OTHER', label: 'Other / Freelancer' },
];

export const LoanApplicationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id || id === 'new';

  const [application, setApplication] = useState<LoanApplication | null>(null);
  const [, setEligibility] = useState<EligibilityCheck | null>(null);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [disbursement, setDisbursement] = useState<DisbursementDetail | null>(null);
  const [verifSummary, setVerifSummary] = useState<VerificationSummary | null>(null);
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

  // Touched state for natural inline validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Verification mode param
  const modeParam = searchParams.get('mode');
  const verificationInitialMode: 'retake' | 'capture' | undefined =
    modeParam === 'retake' ? 'retake' : modeParam === 'capture' ? 'capture' : undefined;

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

      // Load verification summary if offer is selected or under review
      try {
        const vSumm = await fetchVerificationSummary(appId);
        setVerifSummary(vSumm);
      } catch {
        // Non-critical
      }

      // If application has moved past submitted, fetch offers
      if (
        data.status === 'ELIGIBILITY_CHECKED' ||
        data.status === 'OFFER_SELECTED' ||
        data.status === 'UNDER_REVIEW' ||
        data.status === 'APPROVED' ||
        data.status === 'DISBURSEMENT_PROCESSING' ||
        data.status === 'DISBURSED'
      ) {
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

  // Field validation helpers
  const getAmountError = (): string | undefined => {
    if (!touched.requestedAmount) return undefined;
    if (!requestedAmount) return 'Please enter your requested loan amount.';
    const val = parseFloat(requestedAmount);
    if (isNaN(val) || val < 10000) return 'Minimum loan amount is ₹10,000.';
    if (val > 1000000) return 'Maximum loan amount is ₹10,00,000.';
    return undefined;
  };

  const getIncomeError = (): string | undefined => {
    if (!touched.monthlyIncome) return undefined;
    if (!monthlyIncome) return 'Please enter your gross monthly income.';
    const val = parseFloat(monthlyIncome);
    if (isNaN(val) || val < 5000) return 'Minimum monthly income requirement is ₹5,000.';
    return undefined;
  };

  const getEmployerError = (): string | undefined => {
    if (!touched.employerName) return undefined;
    if (!employerName.trim()) {
      return employmentType === 'SALARIED'
        ? 'Please enter your employer or company name.'
        : 'Please enter your business or enterprise name.';
    }
    return undefined;
  };

  const getDesignationError = (): string | undefined => {
    if (!touched.designation) return undefined;
    if (!designation.trim()) {
      return employmentType === 'SALARIED'
        ? 'Please enter your job title or designation.'
        : 'Please enter your profession or business role.';
    }
    return undefined;
  };

  const handleSaveDraft = async () => {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);
    try {
      const payload = getFormData();
      if (isNew) {
        const created = await createApplication(payload);
        setApplication(created);
        setSuccessMessage('✓ Application draft saved successfully.');
        navigate(`/loans/${created.id}`, { replace: true });
      } else if (application) {
        const updated = await updateDraft(application.id, payload);
        setApplication(updated);
        setSuccessMessage('✓ Application draft updated.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to save application draft.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Mark all as touched
    setTouched({
      requestedAmount: true,
      monthlyIncome: true,
      employerName: true,
      designation: true,
    });

    if (!requestedAmount || parseFloat(requestedAmount) < 10000 || parseFloat(requestedAmount) > 1000000) {
      setError('Please enter a valid loan amount between ₹10,000 and ₹10,00,000.');
      return;
    }

    if (!monthlyIncome || parseFloat(monthlyIncome) < 5000) {
      setError('Please enter a valid monthly income of at least ₹5,000.');
      return;
    }

    if (!employerName.trim()) {
      setError('Please provide your employer or business name.');
      return;
    }

    if (!designation.trim()) {
      setError('Please provide your job title or designation.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = getFormData();
      let currentApp = application;

      if (isNew) {
        currentApp = await createApplication(payload);
      } else if (application) {
        currentApp = await updateDraft(application.id, payload);
      }

      if (!currentApp) throw new Error('Could not initialize loan application.');

      const submitted = await submitApplication(currentApp.id);
      setApplication(submitted);
      setSuccessMessage('✓ Application submitted! Ready for credit eligibility assessment.');

      if (isNew) {
        navigate(`/loans/${submitted.id}`, { replace: true });
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to submit application.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvaluateEligibility = async () => {
    if (!application) return;
    setError(null);
    setSuccessMessage(null);
    setEvaluating(true);
    try {
      const result = await checkEligibility(application.id);
      setEligibility(result);
      const refreshed = await fetchApplication(application.id);
      setApplication(refreshed);

      if (refreshed.status === 'ELIGIBILITY_CHECKED') {
        await loadOffers(application.id);
        setSuccessMessage('✓ Congratulations! You are eligible for our pre-approved loan options.');
      } else if (refreshed.status === 'REJECTED') {
        setError('Credit assessment could not approve this request based on debt-to-income limits.');
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Credit eligibility check failed.'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleSelectOffer = async (offerId: string) => {
    if (!application) return;
    setError(null);
    setSuccessMessage(null);
    setSelectingOfferId(offerId);
    try {
      await selectOffer(application.id, offerId);
      const refreshed = await fetchApplication(application.id);
      setApplication(refreshed);
      setSuccessMessage('✓ Plan selected! Proceeding to identity verification.');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to select loan plan.'));
    } finally {
      setSelectingOfferId(null);
    }
  };

  // Derive verification progress
  const hasPhotoRetake = verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED';
  const actionRequiredReason = hasPhotoRetake
    ? verifSummary?.selfie_details?.rejection_reason ||
      'Please submit a clearer photo with your face fully visible.'
    : null;

  const currentVerificationStep =
    !verifSummary || verifSummary.kyc !== 'VERIFIED'
      ? 1
      : verifSummary.bank_account !== 'VERIFIED'
      ? 2
      : verifSummary.selfie !== 'PHOTO_APPROVED' &&
        verifSummary.selfie !== 'PHOTO_PENDING_REVIEW' &&
        verifSummary.selfie !== 'VERIFIED'
      ? 3
      : 4;

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

  const requestedAmountFormatted = requestedAmount
    ? `₹${Number(requestedAmount).toLocaleString('en-IN')}`
    : '—';

  return (
    <CustomerLayout
      status={application?.status}
      applicationNumber={application?.application_number}
      requestedAmount={application?.requested_amount || requestedAmount}
      verificationSummary={verifSummary}
      currentVerificationStep={currentVerificationStep}
      actionRequiredReason={actionRequiredReason}
    >
      <div className="space-y-6 w-full pb-16">
        {/* Top Breadcrumb & App Identifier */}
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E2DC]">
          <Link
            to="/dashboard"
            className="text-xs font-semibold text-[#686D76] hover:text-[#14161A] transition-colors flex items-center gap-1 cursor-pointer"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#14161A]">
              {application ? `#${application.application_number}` : 'New Loan Draft'}
            </span>
            {application && <StatusBadge status={application.status} size="sm" />}
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-2xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs sm:text-sm flex items-center gap-2.5 shadow-xs">
            <span className="text-base">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-xs sm:text-sm flex items-center gap-2.5 font-medium shadow-xs">
            <span className="text-base">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 1: LOAN APPLICATION (DRAFT OR NEW) */}
        {/* ========================================================================= */}
        {(!application || application.status === 'DRAFT') && (
          <div className="space-y-6">
            {/* Page Header */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                LOAN APPLICATION • STEP 1 OF 7
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial">
                Personal Loan Application
              </h1>
              <p className="text-xs sm:text-sm text-[#686D76] leading-relaxed">
                Tell us about your borrowing requirements and employment profile to check your pre-approved borrowing limit.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SECTION 1: Loan Requirements */}
              <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] shadow-xs space-y-5 rounded-2xl">
                <div className="border-b border-[#EAE7E1] pb-3">
                  <span className="text-xs font-bold font-mono text-[#B5652D] uppercase tracking-wider block">
                    1. Loan Requirements
                  </span>
                  <h3 className="text-base font-bold text-[#14161A]">
                    Desired Loan Amount & Tenure
                  </h3>
                  <p className="text-xs text-[#686D76] mt-0.5">
                    Select how much you would like to borrow and your preferred repayment period.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input
                    label="Requested Loan Amount"
                    required
                    type="number"
                    min={10000}
                    max={1000000}
                    step={1000}
                    value={requestedAmount}
                    onChange={(e) => {
                      setRequestedAmount(e.target.value);
                      if (!touched.requestedAmount) setTouched({ ...touched, requestedAmount: true });
                    }}
                    onBlur={() => setTouched({ ...touched, requestedAmount: true })}
                    placeholder="Enter amount"
                    leftAddon="₹"
                    helperText="Enter an amount between ₹10,000 and ₹10,00,000"
                    error={getAmountError()}
                  />

                  <Select
                    label="Requested Loan Tenure"
                    required
                    value={String(requestedTenureMonths)}
                    onChange={(e) => setRequestedTenureMonths(parseInt(e.target.value, 10))}
                    options={TENURE_OPTIONS.map((t) => ({
                      value: String(t),
                      label: `${t} Months (${(t / 12).toFixed(1)} Years)`,
                    }))}
                    helperText="Select repayment duration"
                  />
                </div>

                <div className="space-y-4">
                  <Select
                    label="Loan Purpose"
                    required
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    options={PURPOSE_OPTIONS.map((p) => ({ value: p, label: p }))}
                    helperText="Helps us tailor relevant repayment options"
                  />

                  {purpose === 'Other personal needs' && (
                    <Input
                      label="Specify Purpose"
                      required
                      value={customPurpose}
                      onChange={(e) => setCustomPurpose(e.target.value)}
                      placeholder="Describe your specific loan requirement"
                    />
                  )}
                </div>
              </Card>

              {/* SECTION 2: Income & Employment */}
              <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] shadow-xs space-y-5 rounded-2xl">
                <div className="border-b border-[#EAE7E1] pb-3">
                  <span className="text-xs font-bold font-mono text-[#B5652D] uppercase tracking-wider block">
                    2. Income & Employment
                  </span>
                  <h3 className="text-base font-bold text-[#14161A]">
                    Employment Background & Income
                  </h3>
                  <p className="text-xs text-[#686D76] mt-0.5">
                    Provide your professional details to establish your monthly earning capacity.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Select
                    label="Employment Type"
                    required
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    options={EMPLOYMENT_OPTIONS}
                    helperText="Primary occupation category"
                  />

                  <Input
                    label="Gross Monthly Income"
                    required
                    type="number"
                    min={5000}
                    step={500}
                    value={monthlyIncome}
                    onChange={(e) => {
                      setMonthlyIncome(e.target.value);
                      if (!touched.monthlyIncome) setTouched({ ...touched, monthlyIncome: true });
                    }}
                    onBlur={() => setTouched({ ...touched, monthlyIncome: true })}
                    placeholder="Enter monthly income"
                    leftAddon="₹"
                    helperText="Your monthly income after regular deductions."
                    error={getIncomeError()}
                  />
                </div>

                {/* Progressive Disclosure based on Employment Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                  <Input
                    label={
                      employmentType === 'SALARIED'
                        ? 'Employer / Company Name'
                        : 'Business / Enterprise Name'
                    }
                    required
                    value={employerName}
                    onChange={(e) => {
                      setEmployerName(e.target.value);
                      if (!touched.employerName) setTouched({ ...touched, employerName: true });
                    }}
                    onBlur={() => setTouched({ ...touched, employerName: true })}
                    placeholder={
                      employmentType === 'SALARIED'
                        ? 'Enter employer name'
                        : 'Enter enterprise name'
                    }
                    error={getEmployerError()}
                  />

                  <Input
                    label={
                      employmentType === 'SALARIED'
                        ? 'Job Title / Designation'
                        : 'Profession / Business Role'
                    }
                    required
                    value={designation}
                    onChange={(e) => {
                      setDesignation(e.target.value);
                      if (!touched.designation) setTouched({ ...touched, designation: true });
                    }}
                    onBlur={() => setTouched({ ...touched, designation: true })}
                    placeholder={
                      employmentType === 'SALARIED'
                        ? 'Enter your designation'
                        : 'Enter your profession'
                    }
                    error={getDesignationError()}
                  />
                </div>
              </Card>

              {/* SECTION 3: Existing Financial Commitments */}
              <Card variant="default" padding="lg" className="bg-white border border-[#E5E2DC] shadow-xs space-y-4 rounded-2xl">
                <div className="border-b border-[#EAE7E1] pb-3">
                  <span className="text-xs font-bold font-mono text-[#B5652D] uppercase tracking-wider block">
                    3. Existing Commitments
                  </span>
                  <h3 className="text-base font-bold text-[#14161A]">
                    Existing Monthly EMI Obligations
                  </h3>
                  <p className="text-xs text-[#686D76] mt-0.5">
                    Tell us about your current monthly financial commitments to estimate your repayment capacity.
                  </p>
                </div>

                <Input
                  label="Total Existing Monthly EMI Obligations"
                  type="number"
                  min={0}
                  step={500}
                  value={existingDebt}
                  onChange={(e) => setExistingDebt(e.target.value)}
                  placeholder="0"
                  leftAddon="₹"
                  helperText="Include ongoing credit card EMIs, personal loans, or vehicle loans (enter 0 if none)."
                />
              </Card>

              {/* SECTION 4: Live Application Summary Card */}
              <div className="p-4 sm:p-5 bg-[#FAF8F5] border border-[#E5E2DC] rounded-2xl shadow-2xs space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#686D76] block">
                  Application Summary Preview
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[#8A8D93] block">Loan Amount</span>
                    <strong className="text-sm font-mono font-bold text-[#14161A] block mt-0.5">
                      {requestedAmountFormatted}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A8D93] block">Tenure</span>
                    <strong className="text-sm font-bold text-[#14161A] block mt-0.5">
                      {requestedTenureMonths} Months
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A8D93] block">Purpose</span>
                    <strong className="text-xs font-semibold text-[#14161A] block mt-0.5 truncate">
                      {purpose === 'Other personal needs' ? customPurpose || 'Personal' : purpose}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#8A8D93] block">Gross Monthly Income</span>
                    <strong className="text-sm font-mono font-bold text-[#1E5C4A] block mt-0.5">
                      {monthlyIncome ? `₹${Number(monthlyIncome).toLocaleString('en-IN')}` : '—'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-[#E5E2DC] shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-[#686D76] hidden sm:block">
                  <span>Your information is encrypted & saved securely.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleSaveDraft}
                    isLoading={saving}
                    className="w-full sm:w-auto"
                  >
                    Save as Draft
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={submitting}
                    className="w-full sm:w-auto bg-[#B5652D] hover:bg-[#9C4F1C] text-white shadow-xs font-bold"
                  >
                    Continue to Eligibility Assessment →
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: ELIGIBILITY ASSESSMENT */}
        {/* ========================================================================= */}
        {application?.status === 'SUBMITTED' && (
          <Card variant="elevated" padding="lg" className="bg-white space-y-6 rounded-2xl border border-[#E5E2DC]">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                Stage 2 of 7
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-0.5">
                Eligibility Assessment
              </h1>
              <p className="text-xs sm:text-sm text-[#686D76] mt-1">
                Your loan profile is ready. Run the instant automated financial assessment to receive pre-approved plans.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                <span className="text-[#686D76] block">Requested Amount</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{Number(application.requested_amount).toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="p-3 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                <span className="text-[#686D76] block">Tenure</span>
                <strong className="text-base font-bold text-[#14161A] block mt-0.5">
                  {application.requested_tenure_months} Months
                </strong>
              </div>
              <div className="p-3 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                <span className="text-[#686D76] block">Declared Income</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{Number(application.monthly_income).toLocaleString('en-IN')}/mo
                </strong>
              </div>
              <div className="p-3 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                <span className="text-[#686D76] block">Existing EMI</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{Number(application.existing_debt || 0).toLocaleString('en-IN')}/mo
                </strong>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E2DC] flex justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={handleEvaluateEligibility}
                isLoading={evaluating}
                className="w-full sm:w-auto bg-[#B5652D] hover:bg-[#9C4F1C] text-white"
              >
                Run Credit Assessment & View Offers →
              </Button>
            </div>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: OFFER SELECTION */}
        {/* ========================================================================= */}
        {application?.status === 'ELIGIBILITY_CHECKED' && (
          <div className="space-y-6">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#1E5C4A]">
                Stage 3 of 7 • Pre-Approved
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-0.5">
                Select Your Repayment Plan
              </h1>
              <p className="text-xs sm:text-sm text-[#686D76] mt-1">
                Choose the repayment tenure and monthly EMI schedule that fits your financial goals.
              </p>
            </div>

            {offers.length === 0 ? (
              <div className="p-8 bg-white border border-[#E5E2DC] rounded-2xl text-center space-y-3">
                <p className="text-xs text-[#686D76]">Loading curated loan offers…</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadOffers(application.id)}
                >
                  Refresh Offers
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {offers.map((offer, idx) => {
                  const term = offer.terms?.[0];
                  return (
                    <Card
                      key={offer.id}
                      variant="elevated"
                      padding="lg"
                      className={`bg-white space-y-4 relative flex flex-col justify-between border-2 rounded-2xl ${
                        idx === 1
                          ? 'border-[#B5652D] shadow-md ring-2 ring-[#B5652D]/10'
                          : 'border-[#E5E2DC]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              idx === 1
                                ? 'bg-[#FAF3EE] text-[#B5652D] border border-[#F3D7C4]'
                                : 'bg-[#F2EFE9] text-[#686D76]'
                            }`}
                          >
                            {idx === 0 ? 'Short Term' : idx === 1 ? 'Recommended' : 'Lowest EMI'}
                          </span>
                          <span className="text-xs text-[#8A8D93] font-mono">
                            {term ? term.tenure_months : 36} Mo
                          </span>
                        </div>

                        <div>
                          <span className="text-xs text-[#686D76] block">Monthly Repayment</span>
                          <span className="text-2xl font-bold font-mono text-[#14161A] block">
                            ₹{term ? Number(term.emi).toLocaleString('en-IN') : '—'}
                          </span>
                          <span className="text-[11px] text-[#8A8D93]">per month</span>
                        </div>

                        <div className="pt-2 border-t border-[#EAE7E1] space-y-1 text-xs text-[#686D76]">
                          <div className="flex justify-between">
                            <span>Principal:</span>
                            <strong className="text-[#14161A] font-mono">
                              ₹{Number(offer.principal).toLocaleString('en-IN')}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Interest Rate:</span>
                            <strong className="text-[#14161A] font-mono">
                              {Number(offer.interest_rate).toFixed(2)}% p.a.
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Total Interest:</span>
                            <strong className="text-[#14161A] font-mono">
                              ₹{term ? Number(term.total_interest).toLocaleString('en-IN') : '—'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-[#EAE7E1]">
                        <Button
                          variant={idx === 1 ? 'primary' : 'outline'}
                          size="md"
                          className="w-full"
                          isLoading={selectingOfferId === offer.id}
                          onClick={() => handleSelectOffer(offer.id)}
                        >
                          Select This Plan →
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: VERIFICATION WIZARD */}
        {/* ========================================================================= */}
        {application?.status === 'OFFER_SELECTED' && (
          <div className="space-y-6">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                Stage 4 of 7
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-0.5">
                Identity & Bank Verification
              </h1>
              <p className="text-xs sm:text-sm text-[#686D76] mt-1">
                Complete your identity document upload, bank account verification, and in-browser live selfie.
              </p>
            </div>

            {hasPhotoRetake && (
              <div className="p-4 bg-[#FAF3F2] border-2 border-[#8C3A32] rounded-2xl flex items-start gap-3 shadow-xs">
                <span className="text-2xl mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#8C3A32] uppercase tracking-wider block">
                    Action Required: Live Photo Retake
                  </span>
                  <p className="text-xs text-[#686D76]">
                    Credit Officer Remark: &ldquo;{actionRequiredReason}&rdquo;
                  </p>
                </div>
              </div>
            )}

            <VerificationWizard
              applicationId={application.id}
              initialMode={verificationInitialMode}
              onVerificationComplete={async () => {
                const refreshed = await fetchApplication(application.id);
                setApplication(refreshed);
                setSuccessMessage('All verification steps submitted for Underwriting review.');
              }}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 5: UNDERWRITING REVIEW */}
        {/* ========================================================================= */}
        {application?.status === 'UNDER_REVIEW' && (
          <div className="space-y-6">
            {hasPhotoRetake ? (
              <Card variant="elevated" padding="lg" className="border-t-4 border-t-[#8C3A32] bg-white space-y-4 rounded-2xl">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">⚠️</span>
                  <div className="space-y-1">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8C3A32]">
                      Action Required
                    </span>
                    <h2 className="text-xl font-bold text-[#14161A] font-editorial">
                      Your live selfie needs to be retaken
                    </h2>
                    <p className="text-xs text-[#686D76]">
                      Reason from Credit Officer:{' '}
                      <span className="font-semibold text-[#8C3A32]">
                        &quot;{actionRequiredReason}&quot;
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <VerificationWizard
                    applicationId={application.id}
                    initialMode="retake"
                    onVerificationComplete={async () => {
                      const refreshed = await fetchApplication(application.id);
                      setApplication(refreshed);
                      setSuccessMessage('New photo submitted! Our team is reviewing your application.');
                    }}
                  />
                </div>
              </Card>
            ) : (
              <Card variant="elevated" padding="lg" className="border-t-4 border-t-[#B5652D] bg-white space-y-4 text-center py-10 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-2xl mx-auto shadow-xs">
                  ⚖️
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                    Stage 5 of 7 • Case in Progress
                  </span>
                  <h2 className="text-2xl font-bold text-[#14161A] font-editorial">
                    Underwriting Review in Progress
                  </h2>
                  <p className="text-xs sm:text-sm text-[#686D76]">
                    Your verified identity documents and live selfie are currently under manual review by our Credit Officers. Decisions are typically completed within 15 minutes.
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGES 6 & 7: APPROVAL & DISBURSEMENT */}
        {/* ========================================================================= */}
        {(application?.status === 'APPROVED' ||
          application?.status === 'DISBURSEMENT_PROCESSING' ||
          application?.status === 'DISBURSED') && (
          <Card variant="elevated" padding="lg" className="border-t-4 border-t-[#1E5C4A] bg-white space-y-6 rounded-2xl">
            <div className="border-b border-[#E5E2DC] pb-4">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#1E5C4A]">
                {application.status === 'DISBURSED'
                  ? 'Stage 7 of 7 • Disbursed'
                  : 'Stage 6 of 7 • Approved & Sanctioned'}
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-0.5">
                {application.status === 'DISBURSED'
                  ? 'Loan Disbursed to Your Bank'
                  : 'Loan Sanction & Authorization'}
              </h1>
              <p className="text-xs sm:text-sm text-[#686D76] mt-1">
                {application.status === 'DISBURSED'
                  ? 'Your funds have been electronically transferred to your verified bank account.'
                  : 'Your loan has been officially approved. Electronic fund transfer is in progress.'}
              </p>
            </div>

            {disbursement && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76] block">Sanctioned Amount</span>
                  <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                    ₹{Number(disbursement.approved_amount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76] block">Net Payout</span>
                  <strong className="text-base font-mono text-[#1E5C4A] block mt-0.5">
                    ₹{Number(disbursement.net_disbursement_amount || disbursement.approved_amount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76] block">Monthly EMI</span>
                  <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                    ₹{disbursement.emi ? Number(disbursement.emi).toLocaleString('en-IN') : '—'}
                  </strong>
                </div>
                <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76] block">Tenure / Rate</span>
                  <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                    {disbursement.tenure_months}M @ {Number(disbursement.interest_rate || 0).toFixed(2)}%
                  </strong>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </CustomerLayout>
  );
};

export default LoanApplicationForm;
