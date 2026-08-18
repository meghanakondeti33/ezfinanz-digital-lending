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
import type {
  EligibilityCheck,
  LoanApplication,
  LoanApplicationPayload,
  LoanOffer,
} from '../types/loan';

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
      if (data.status === 'ELIGIBILITY_CHECKED' || data.status === 'OFFER_SELECTED') {
        loadOffers(appId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load loan application.');
    } finally {
      setLoading(false);
    }
  };

  const loadOffers = async (appId: string) => {
    try {
      const data = await fetchOffers(appId);
      setOffers(data.offers);
    } catch (err) {
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
        setSuccessMessage('Draft application created successfully!');
        navigate(`/loans/${created.id}`, { replace: true });
      } else if (application) {
        const updated = await updateDraft(application.id, payload);
        setApplication(updated);
        setSuccessMessage('Draft saved successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save draft.');
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
      setSuccessMessage('🎉 Application submitted successfully! You can now check loan eligibility.');
      navigate(`/loans/${submitted.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to submit application. Please check required fields.');
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

      // Refresh application state & offers
      const updatedApp = await fetchApplication(application.id);
      setApplication(updatedApp);

      if (checkResult.status === 'ELIGIBLE') {
        setSuccessMessage('Your application passed the initial eligibility assessment.');
        await loadOffers(application.id);
      } else {
        setError('Application is ineligible based on underwriting rules. Review the decision details below.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate eligibility.');
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
      const selected = await selectOffer(application.id, offerId);
      setSuccessMessage('🎉 Loan offer selected successfully! Your repayment terms have been locked.');

      // Refresh application & offers
      const updatedApp = await fetchApplication(application.id);
      setApplication(updatedApp);
      await loadOffers(application.id);
    } catch (err: any) {
      setError(err.message || 'Failed to select loan offer.');
    } finally {
      setSelectingOfferId(null);
    }
  };

  const isSubmittedOrHigher =
    application?.status === 'SUBMITTED' ||
    application?.status === 'ELIGIBILITY_CHECKED' ||
    application?.status === 'OFFER_SELECTED';

  const isOfferSelected = application?.status === 'OFFER_SELECTED';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-emerald-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-slate-300 font-medium">Loading application details…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-emerald-400 transition-colors"
          >
            ← Back to Dashboard
          </Link>
          <span className="text-xs font-mono text-slate-500">
            {application ? application.application_number : 'New Application Draft'}
          </span>
        </div>

        {/* Status Header Banner */}
        {application && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between ${
              isOfferSelected
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : isSubmittedOrHigher
                ? 'bg-blue-950/40 border-blue-800 text-blue-300'
                : 'bg-yellow-950/30 border-yellow-800/60 text-yellow-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  isOfferSelected
                    ? 'bg-emerald-400'
                    : isSubmittedOrHigher
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-yellow-400'
                }`}
              />
              <div>
                <span className="font-bold text-sm block">
                  Status: {application.status}
                </span>
                <span className="text-xs opacity-80">
                  {isOfferSelected
                    ? 'Loan offer confirmed. Next phase: verification & disbursement.'
                    : application.status === 'ELIGIBILITY_CHECKED'
                    ? 'Eligibility checked. Compare and select your preferred loan offer below.'
                    : application.status === 'SUBMITTED'
                    ? 'Application submitted. Click Check Eligibility to proceed.'
                    : 'Draft application (editable). Click Submit when ready.'}
                </span>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-900 border border-slate-700">
              {application.application_number}
            </span>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="p-4 rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-sm flex items-start space-x-2">
            <svg className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-sm flex items-start space-x-2">
            <svg className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM16.707 7.707a1 1 0 00-1.414-1.414L9 12.586 5.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l7-7z" clipRule="evenodd" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Phase 4: Eligibility Check Trigger (When SUBMITTED) */}
        {application?.status === 'SUBMITTED' && (
          <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-slate-900 border border-blue-800/80 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⚡</span> Run Instant Eligibility Assessment
              </h2>
              <p className="text-sm text-slate-300 mt-1 max-w-xl">
                Our automated underwriting engine evaluates your financial profile against debt-to-income and affordability criteria in real time.
              </p>
            </div>
            <button
              onClick={handleCheckEligibility}
              disabled={evaluating}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {evaluating ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Evaluating Profile…</span>
                </>
              ) : (
                <span>Check Loan Eligibility →</span>
              )}
            </button>
          </div>
        )}

        {/* Phase 4: Eligibility Decision Box */}
        {eligibility && (
          <div
            className={`border rounded-2xl p-6 shadow-xl ${
              eligibility.status === 'ELIGIBLE'
                ? 'bg-emerald-950/30 border-emerald-800/80'
                : 'bg-red-950/30 border-red-800/80'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Eligibility Assessment Result
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                  <span>{eligibility.status === 'ELIGIBLE' ? '✅' : '❌'}</span>
                  <span>Decision: {eligibility.status}</span>
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-xs text-slate-400 block">Eligibility Score</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    {eligibility.score ? Number(eligibility.score).toFixed(0) : 'N/A'}/100
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-xs text-slate-400 block">DTI Ratio</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {eligibility.dti_ratio ? `${(Number(eligibility.dti_ratio) * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Explainable Decision Rationale:
              </span>
              <ul className="space-y-1.5">
                {eligibility.reasons?.map((reason, idx) => (
                  <li key={idx} className="text-xs text-slate-300 flex items-start space-x-2">
                    <span className={eligibility.status === 'ELIGIBLE' ? 'text-emerald-400' : 'text-red-400'}>
                      •
                    </span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-800/60 italic">
                * Internal deterministic eligibility score based on submitted financial information. Not a bureau credit score.
              </p>
            </div>
          </div>
        )}

        {/* Phase 4: Loan Offers Comparison Suite */}
        {offers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Compare Loan Offers</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select your preferred repayment tenure and interest rate structure.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {offers.length} Offers Available
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {offers.map((offer, idx) => {
                const term = offer.terms[0];
                const isSelected = offer.status === 'SELECTED';

                return (
                  <div
                    key={offer.id}
                    className={`rounded-2xl border transition-all flex flex-col justify-between p-5 relative ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500 shadow-xl shadow-emerald-950/50'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Selected Badge */}
                    {isSelected && (
                      <span className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-white shadow-md flex items-center gap-1">
                        <span>✓</span> Selected Offer
                      </span>
                    )}

                    <div className="space-y-4 pt-1">
                      <div>
                        <span className="text-xs text-slate-400 font-medium">
                          {idx === 0
                            ? 'Standard Plan'
                            : idx === 1
                            ? 'Low Monthly EMI'
                            : 'Fast Payoff Plan'}
                        </span>
                        <div className="mt-1">
                          <span className="text-2xl font-black text-white font-mono">
                            ₹{term ? Number(term.emi).toLocaleString('en-IN') : '0'}
                          </span>
                          <span className="text-xs text-slate-400"> / month</span>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Loan Amount:</span>
                          <span className="font-semibold text-white font-mono">
                            ₹{Number(offer.principal).toLocaleString('en-IN')}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-400">Interest Rate:</span>
                          <span className="font-semibold text-emerald-400 font-mono">
                            {Number(offer.interest_rate).toFixed(2)}% p.a.
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-400">Tenure:</span>
                          <span className="font-semibold text-white">
                            {term ? `${term.tenure_months} Months` : 'N/A'}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Interest:</span>
                          <span className="font-semibold text-slate-300 font-mono">
                            ₹{term ? Number(term.total_interest).toLocaleString('en-IN') : '0'}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-400">Processing Fee + GST:</span>
                          <span className="font-semibold text-slate-300 font-mono">
                            ₹{term ? Number(term.total_charges).toLocaleString('en-IN') : '0'}
                          </span>
                        </div>

                        <div className="flex justify-between border-t border-slate-800/80 pt-2 font-medium">
                          <span className="text-slate-400">Net Disbursement:</span>
                          <span className="text-emerald-300 font-mono">
                            ₹{term ? Number(term.net_disbursement).toLocaleString('en-IN') : '0'}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Repayment:</span>
                          <span className="text-white font-mono font-bold">
                            ₹{term ? Number(term.total_repayment).toLocaleString('en-IN') : '0'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-5 mt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleSelectOffer(offer.id)}
                        disabled={isSelected || selectingOfferId !== null}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
                            : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-md'
                        } disabled:opacity-70`}
                      >
                        {selectingOfferId === offer.id
                          ? 'Selecting…'
                          : isSelected
                          ? '✓ Plan Confirmed'
                          : 'Select This Offer'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loan Application Details Form Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="border-b border-slate-800 pb-5 mb-6">
            <h1 className="text-2xl font-bold text-white">
              {isSubmittedOrHigher ? 'Application Summary' : 'Personal Loan Details'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isSubmittedOrHigher
                ? 'Your loan application parameters are locked and recorded.'
                : 'Provide your loan requirement and financial background. You can save your draft at any time.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Loan Requirement */}
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">
                1. Loan Requirement
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Requested Amount (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="10000"
                    max="5000000"
                    step="1000"
                    disabled={isSubmittedOrHigher}
                    required
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="e.g. 500000"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Requested Tenure <span className="text-red-400">*</span>
                  </label>
                  <select
                    disabled={isSubmittedOrHigher}
                    value={requestedTenureMonths}
                    onChange={(e) => setRequestedTenureMonths(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {TENURE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t} Months ({t / 12 >= 1 ? `${t / 12} ${t / 12 === 1 ? 'Year' : 'Years'}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Purpose of Loan <span className="text-red-400">*</span>
                  </label>
                  <select
                    disabled={isSubmittedOrHigher}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {PURPOSE_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  {purpose === 'Other personal needs' && (
                    <input
                      type="text"
                      disabled={isSubmittedOrHigher}
                      value={customPurpose}
                      onChange={(e) => setCustomPurpose(e.target.value)}
                      placeholder="Please specify your loan purpose"
                      className="mt-2 w-full px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Financial & Employment Profile */}
            <div className="pt-4 border-t border-slate-800">
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4">
                2. Employment & Income Details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Employment Type <span className="text-red-400">*</span>
                  </label>
                  <select
                    disabled={isSubmittedOrHigher}
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {EMPLOYMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Gross Monthly Income (₹) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="5000"
                    step="500"
                    disabled={isSubmittedOrHigher}
                    required
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="e.g. 60000"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Employer / Business Name
                  </label>
                  <input
                    type="text"
                    disabled={isSubmittedOrHigher}
                    value={employerName}
                    onChange={(e) => setEmployerName(e.target.value)}
                    placeholder="e.g. Example Technologies"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Designation / Role
                  </label>
                  <input
                    type="text"
                    disabled={isSubmittedOrHigher}
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Existing Monthly Debt / EMIs (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    disabled={isSubmittedOrHigher}
                    value={existingDebt}
                    onChange={(e) => setExistingDebt(e.target.value)}
                    placeholder="e.g. 10000"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    Include active credit cards, personal loans, or vehicle loan EMIs.
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-medium text-center transition-all"
              >
                Back to Dashboard
              </Link>

              {!isSubmittedOrHigher ? (
                <div className="w-full sm:w-auto flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving || submitting}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving Draft…' : 'Save Draft'}
                  </button>

                  <button
                    type="submit"
                    disabled={saving || submitting}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-sm font-bold shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                  >
                    {submitting ? 'Submitting…' : 'Submit Application'}
                  </button>
                </div>
              ) : (
                <span className="text-xs text-blue-400 font-medium">
                  ✓ Application details locked in {application.status} state.
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoanApplicationForm;
