import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  createApplication,
  fetchApplication,
  submitApplication,
  updateDraft,
} from '../lib/loans-api';
import type { LoanApplication, LoanApplicationPayload } from '../types/loan';

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
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load loan application.');
    } finally {
      setLoading(false);
    }
  };

  const getFormData = (): LoanApplicationPayload => {
    const finalPurpose = purpose === 'Other personal needs' && customPurpose.trim()
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

      // If new, create first
      if (isNew || !currentAppId) {
        const created = await createApplication(payload);
        currentAppId = created.id;
        setApplication(created);
      } else {
        // Save current changes to draft before submitting
        const updated = await updateDraft(currentAppId, payload);
        setApplication(updated);
      }

      // Submit application
      const submitted = await submitApplication(currentAppId);
      setApplication(submitted);
      setSuccessMessage('🎉 Application submitted successfully! Your loan is now under review.');
      navigate(`/loans/${submitted.id}`, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to submit application. Please check required fields.');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitted = application?.status === 'SUBMITTED';

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
      <div className="max-w-3xl mx-auto space-y-6">
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
              isSubmitted
                ? 'bg-blue-950/40 border-blue-800 text-blue-300'
                : 'bg-yellow-950/30 border-yellow-800/60 text-yellow-300'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  isSubmitted ? 'bg-blue-400 animate-pulse' : 'bg-yellow-400'
                }`}
              />
              <div>
                <span className="font-bold text-sm block">
                  Status: {application.status}
                </span>
                <span className="text-xs opacity-80">
                  {isSubmitted
                    ? `Submitted on ${new Date(application.submitted_at || application.updated_at).toLocaleString()}`
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

        {/* Form Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
          <div className="border-b border-slate-800 pb-5 mb-6">
            <h1 className="text-2xl font-bold text-white">
              {isSubmitted ? 'Loan Application Overview' : 'Personal Loan Details'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {isSubmitted
                ? 'Your application is securely locked and submitted for administrative review.'
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                      disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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
                    disabled={isSubmitted}
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

              {!isSubmitted ? (
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
                  ✓ Application is locked for administrative review.
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
