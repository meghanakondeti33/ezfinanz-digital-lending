import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAdminApplicationDetail,
  submitAdminDecision,
} from '../../lib/admin-api';
import {
  confirmAdminDisbursement,
  fetchAdminDisbursement,
  initiateAdminDisbursement,
} from '../../lib/disbursement-api';
import type { AdminApplicationDetail } from '../../types/admin';
import type { DisbursementDetail } from '../../types/disbursement';
import { extractErrorMessage } from '../../lib/error-utils';

const REJECTION_REASONS = [
  'Verification issue',
  'Income insufficient',
  'Risk policy violation',
  'Incomplete information',
  'High debt-to-income ratio',
  'Other',
];

export const AdminApplicationReview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<AdminApplicationDetail | null>(null);
  const [disbursement, setDisbursement] = useState<DisbursementDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Decision Modals
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  // Disbursement Modals
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [showConfirmDisburseModal, setShowConfirmDisburseModal] = useState<boolean>(false);
  const [disburseRemarks, setDisburseRemarks] = useState<string>('');
  const [processingDisbursement, setProcessingDisbursement] = useState<boolean>(false);

  const loadDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminApplicationDetail(id);
      setApplication(data);

      if (
        data.status === 'APPROVED' ||
        data.status === 'DISBURSEMENT_PROCESSING' ||
        data.status === 'DISBURSED'
      ) {
        try {
          const disbData = await fetchAdminDisbursement(id);
          setDisbursement(disbData);
        } catch {
          // Non-critical
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load application review details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      setSubmittingDecision(true);
      setError(null);
      await submitAdminDecision(id, {
        decision: 'APPROVED',
        remarks: adminRemarks || 'Approved by underwriter.',
      });
      setSuccess('🎉 Loan application approved successfully! Application state transitioned to APPROVED.');
      setShowApproveModal(false);
      setAdminRemarks('');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve application.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    if (!rejectionReason) {
      setError('Please select a rejection reason.');
      return;
    }

    try {
      setSubmittingDecision(true);
      setError(null);
      await submitAdminDecision(id, {
        decision: 'REJECTED',
        rejection_reason: rejectionReason,
        remarks: adminRemarks,
      });
      setSuccess('Application has been rejected. Decision and reason have been permanently recorded.');
      setShowRejectModal(false);
      setAdminRemarks('');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to reject application.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleInitiateDisbursement = async () => {
    if (!id) return;
    try {
      setProcessingDisbursement(true);
      setError(null);
      const res = await initiateAdminDisbursement(id, disburseRemarks || 'Electronic fund transfer initiated');
      setSuccess(`⚡ Disbursement initiated successfully! Reference: ${res.disbursement_reference}`);
      setShowDisburseModal(false);
      setDisburseRemarks('');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to initiate disbursement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  const handleConfirmDisbursement = async () => {
    if (!id) return;
    try {
      setProcessingDisbursement(true);
      setError(null);
      const res = await confirmAdminDisbursement(id, disburseRemarks || 'Bank settlement completed');
      setSuccess(`🎉 Disbursement completed & settled! Application transitioned to DISBURSED. Reference: ${res.disbursement_reference}`);
      setShowConfirmDisburseModal(false);
      setDisburseRemarks('');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to confirm disbursement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'UNDER_REVIEW':
        return 'bg-amber-950/60 border-amber-700 text-amber-300 animate-pulse';
      case 'APPROVED':
        return 'bg-emerald-950/60 border-emerald-700 text-emerald-300 shadow-lg shadow-emerald-950/50';
      case 'DISBURSEMENT_PROCESSING':
        return 'bg-blue-950/60 border-blue-700 text-blue-300 animate-pulse';
      case 'DISBURSED':
        return 'bg-teal-950/60 border-teal-600 text-teal-300 font-bold';
      case 'REJECTED':
        return 'bg-rose-950/60 border-rose-700 text-rose-300';
      default:
        return 'bg-blue-950/60 border-blue-700 text-blue-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-xs text-slate-400">Loading full underwriting profile...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <p className="text-sm text-red-400 font-semibold">{error || 'Application not found.'}</p>
          <Link to="/admin" className="inline-block px-4 py-2 bg-slate-800 text-xs rounded-xl hover:bg-slate-700">
            ← Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  const isUnderReview = application.status === 'UNDER_REVIEW';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/admin" className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold">
              <span>←</span> Application Queue
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-mono font-bold text-white">
              {application.application_number}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase border ${getStatusBadgeClass(
                application.status
              )}`}
            >
              {application.status}
            </span>
          </div>
        </div>
      </header>

      {/* Main Review Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title Bar & Decision Action Panel */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Credit Risk Assessment & Decisioning
            </span>
            <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-3">
              <span>Application #{application.application_number}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Applicant: <span className="text-white font-semibold">{application.customer.full_name || 'N/A'}</span> ({application.customer.email})
            </p>
          </div>

          {/* Underwriter Action Controls */}
          {isUnderReview ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-5 py-2.5 rounded-xl bg-rose-950/60 border border-rose-700 hover:bg-rose-900 text-rose-300 font-bold text-xs shadow-lg transition-all"
              >
                Reject Application
              </button>
              <button
                type="button"
                onClick={() => setShowApproveModal(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-950/50 transition-all"
              >
                ✓ Approve Application
              </button>
            </div>
          ) : application.status === 'APPROVED' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDisburseModal(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-black text-xs shadow-lg shadow-blue-950/50 transition-all flex items-center gap-2"
              >
                <span>⚡</span> Initiate Loan Disbursement
              </button>
            </div>
          ) : application.status === 'DISBURSEMENT_PROCESSING' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDisburseModal(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-lg shadow-teal-950/50 transition-all flex items-center gap-2"
              >
                <span>💳</span> Confirm & Settle Disbursement
              </button>
            </div>
          ) : application.status === 'DISBURSED' ? (
            <div className="p-3 bg-teal-950/40 border border-teal-700/60 rounded-2xl text-xs text-teal-300 flex items-center gap-2">
              <span>✅</span>
              <div>
                <span className="font-bold block">Disbursed & Settled</span>
                <span className="font-mono text-[11px] text-teal-400">
                  {disbursement?.disbursement_reference || 'EZF-DIS-COMPLETED'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-400">
              <span className="font-semibold text-slate-200 block">Application Status:</span>
              <span className="font-bold text-white">{application.status}</span>
            </div>
          )}
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-red-900/40 border border-red-800 text-red-300 text-xs flex items-center space-x-2">
            <span>⚠️ {error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-900/40 border border-emerald-800 text-emerald-300 text-xs flex items-center space-x-2">
            <span>✓ {success}</span>
          </div>
        )}

        {/* 2-Column Inspection Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Customer Profile & Financial Parameters */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Customer Profile & Financials */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                <span>👤</span> 1. Customer Profile & Loan Details
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs pt-2">
                <div>
                  <span className="text-slate-400 block">Full Name:</span>
                  <span className="font-bold text-white text-sm">{application.customer.full_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email Address:</span>
                  <span className="font-semibold text-slate-200">{application.customer.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Phone Number:</span>
                  <span className="font-semibold text-slate-200">{application.customer.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Requested Amount:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {application.loan_details.requested_amount
                      ? `₹${Number(application.loan_details.requested_amount).toLocaleString('en-IN')}`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Monthly Income:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {application.loan_details.monthly_income
                      ? `₹${Number(application.loan_details.monthly_income).toLocaleString('en-IN')}`
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Existing Debt:</span>
                  <span className="font-mono font-semibold text-slate-300">
                    {application.loan_details.existing_debt
                      ? `₹${Number(application.loan_details.existing_debt).toLocaleString('en-IN')}`
                      : '₹0.00'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Employment Type:</span>
                  <span className="font-semibold text-slate-200">{application.loan_details.employment_type || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Employer Name:</span>
                  <span className="font-semibold text-slate-200">{application.loan_details.employer_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Loan Purpose:</span>
                  <span className="font-semibold text-slate-200">{application.loan_details.purpose || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Deterministic Eligibility Rationale */}
            {application.eligibility && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <span>⚡</span> 2. Deterministic Underwriting Assessment
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-emerald-400">
                      Score: {application.eligibility.score ? Number(application.eligibility.score).toFixed(0) : 'N/A'}/100
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-slate-200">
                      DTI: {application.eligibility.dti_ratio ? `${(Number(application.eligibility.dti_ratio) * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 block mb-2">
                    Engine Rationale & Criteria:
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {application.eligibility.reasons?.map((r, i) => (
                      <li key={i} className="flex items-start space-x-2">
                        <span className="text-emerald-400">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Section 3: Selected Loan Offer & Terms */}
            {application.selected_offer && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                  <span>📑</span> 3. Selected Loan Offer & Amortization
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Principal</span>
                    <span className="font-mono font-bold text-white text-sm">
                      ₹{Number(application.selected_offer.principal).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Monthly EMI</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ₹{Number(application.selected_offer.emi).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Interest Rate</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {Number(application.selected_offer.interest_rate).toFixed(2)}% p.a.
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Tenure</span>
                    <span className="font-bold text-white text-sm">
                      {application.selected_offer.tenure_months} Months
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div>
                    <span className="text-slate-400 block">Processing Fee + GST:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      ₹{Number(application.selected_offer.total_charges).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Net Payout to Bank:</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      ₹{Number(application.selected_offer.net_disbursement).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Repayment:</span>
                    <span className="font-mono font-bold text-white">
                      ₹{Number(application.selected_offer.total_repayment).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Phase 7 Disbursement & Fund Settlement */}
            {disbursement && (
              <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-blue-800/60 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <span>⚡</span> 4. Loan Disbursement & Payout Details
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-950 border border-blue-700 text-blue-300">
                    {disbursement.disbursement_status || 'PENDING'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Approved Amount</span>
                    <span className="font-mono font-bold text-white text-sm">
                      ₹{Number(disbursement.approved_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Net Payout to Bank</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ₹{Number(disbursement.net_disbursement_amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Disbursement Ref</span>
                    <span className="font-mono font-bold text-white text-xs">
                      {disbursement.disbursement_reference || 'Not Generated'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Destination Bank</span>
                    <span className="font-bold text-white text-xs">
                      {disbursement.destination_bank_name ? `${disbursement.destination_bank_name} (*${disbursement.destination_account_last4})` : 'N/A'}
                    </span>
                  </div>
                </div>

                {disbursement.initiated_at && (
                  <div className="text-[11px] text-slate-400 flex flex-wrap gap-4 pt-2 border-t border-slate-800/60">
                    <span>Initiated: <strong className="text-slate-200">{new Date(disbursement.initiated_at).toLocaleString('en-IN')}</strong></span>
                    {disbursement.completed_at && (
                      <span>Completed: <strong className="text-emerald-400">{new Date(disbursement.completed_at).toLocaleString('en-IN')}</strong></span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: 4-Step Verification & Audit Logs */}
          <div className="space-y-6">
            {/* Verification Status Cards */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                  <span>🛡️</span> 5. Customer Verification
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    application.verification.status === 'COMPLETED'
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-700 text-amber-300'
                  }`}
                >
                  {application.verification.status}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                {/* KYC */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">KYC Verification</span>
                    <span className="text-emerald-400 font-bold">✓ Verified</span>
                  </div>
                  {application.verification.kyc && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span>{application.verification.kyc.id_type}: {application.verification.kyc.id_number_masked}</span>
                    </div>
                  )}
                </div>

                {/* Bank */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Bank Account</span>
                    <span className="text-emerald-400 font-bold">✓ Verified</span>
                  </div>
                  {application.verification.bank_account && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span>{application.verification.bank_account.bank_name} ({application.verification.bank_account.account_number_masked})</span>
                    </div>
                  )}
                </div>

                {/* Selfie */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Live Photo / Selfie</span>
                    <span className="text-emerald-400 font-bold">✓ Verified</span>
                  </div>
                </div>

                {/* Declaration */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">Legal Declaration</span>
                    <span className="text-emerald-400 font-bold">✓ Accepted</span>
                  </div>
                  {application.verification.declaration && (
                    <div className="text-[11px] text-slate-400 mt-1">
                      <span>Version: {application.verification.declaration.declaration_version}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audit Trail Log */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <span>📋</span> 6. Application Audit Trail
              </h2>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {application.audit_logs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No audit records yet.</p>
                ) : (
                  application.audit_logs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-bold text-indigo-300 text-[11px]">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(log.created_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-slate-500">{log.old_status || 'START'}</span>
                        <span>→</span>
                        <span className="text-white font-semibold">{log.new_status || 'END'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* APPROVAL MODAL */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-emerald-400">
              <span className="text-2xl">✓</span>
              <h3 className="text-lg font-bold text-white">Approve Loan Application</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Confirm credit approval for application <strong className="text-white font-mono">{application.application_number}</strong>. This locks underwriting and authorizes disbursement.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Underwriter Notes / Approval Remarks (Optional)
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="e.g. Verified salary slip and low DTI ratio. Approved for standard disbursement."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDecision}
                onClick={handleApprove}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                {submittingDecision ? 'Approving...' : 'Confirm Approval →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INITIATE DISBURSEMENT MODAL */}
      {showDisburseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-blue-400">
              <span className="text-2xl">⚡</span>
              <h3 className="text-lg font-bold text-white">Initiate Loan Disbursement</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Initiate electronic fund transfer for application <strong className="text-white font-mono">{application.application_number}</strong>. This transitions the application to <strong className="text-blue-300">DISBURSEMENT_PROCESSING</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Disbursement Reference Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={disburseRemarks}
                onChange={(e) => setDisburseRemarks(e.target.value)}
                placeholder="e.g. Initiated NEFT payout batch #4401."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisburseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingDisbursement}
                onClick={handleInitiateDisbursement}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                {processingDisbursement ? 'Processing...' : 'Initiate Payout →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DISBURSEMENT MODAL */}
      {showConfirmDisburseModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-teal-600/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-teal-400">
              <span className="text-2xl">💳</span>
              <h3 className="text-lg font-bold text-white">Confirm Bank Settlement</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Confirm successful receipt of bank settlement. This transitions application <strong className="text-white font-mono">{application.application_number}</strong> to final <strong className="text-emerald-300">DISBURSED</strong> state.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Settlement Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={disburseRemarks}
                onChange={(e) => setDisburseRemarks(e.target.value)}
                placeholder="e.g. Bank UTR settlement confirmed by core banking system."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmDisburseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingDisbursement}
                onClick={handleConfirmDisbursement}
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                {processingDisbursement ? 'Confirming...' : 'Confirm Settlement & Disburse →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center space-x-3 text-rose-400">
              <span className="text-2xl">❌</span>
              <h3 className="text-lg font-bold text-white">Reject Loan Application</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Please specify the mandatory rejection category and reason for declining application <strong className="text-white font-mono">{application.application_number}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rejection Reason Category *
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Detailed Underwriter Remarks
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Explain the specific risk parameter or failure justification..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingDecision}
                onClick={handleReject}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                {submittingDecision ? 'Rejecting...' : 'Confirm Rejection →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
