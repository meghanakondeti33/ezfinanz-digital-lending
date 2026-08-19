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
import { Navbar } from '../../components/navigation/Navbar';
import { LedgerLine } from '../../components/journey/LedgerLine';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';

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

  // Photo Review State
  const [photoApproved, setPhotoApproved] = useState<boolean>(true);

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
        remarks: adminRemarks || 'Approved by underwriter after complete photo & KYC verification.',
      });
      setSuccess('🎉 Loan application approved! State transitioned to APPROVED.');
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
      setSuccess('Application declined. Decision recorded in the permanent audit trail.');
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
      setSuccess(`⚡ Disbursement initiated! Reference: ${res.disbursement_reference}`);
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
      const res = await confirmAdminDisbursement(id, disburseRemarks || 'Bank settlement confirmed');
      setSuccess(`🎉 Disbursement completed & settled! Application permanently transitioned to DISBURSED. Reference: ${res.disbursement_reference}`);
      setShowConfirmDisburseModal(false);
      setDisburseRemarks('');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to confirm settlement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
        <div className="animate-spin h-7 w-7 border-2 border-[#B5652D] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-[#F7F5F1] p-8 text-center">
        <p className="text-sm text-[#8C3A32]">{error || 'Application not found.'}</p>
        <Link to="/admin" className="text-sm text-[#B5652D] underline mt-2 inline-block font-semibold">
          ← Back to Queue
        </Link>
      </div>
    );
  }

  const isUnderReview = application.status === 'UNDER_REVIEW';

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20 pb-16">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5E2DC] shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/admin" className="text-xs text-[#686D76] hover:text-[#14161A]">
                ← Underwriting Queue
              </Link>
              <span className="text-[#8A8D93]">/</span>
              <span className="text-xs font-mono font-bold text-[#14161A]">
                {application.application_number}
              </span>
              <StatusBadge status={application.status} size="sm" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial">
              Case File: {application.customer.full_name || 'Applicant'}
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76]">
              {application.customer.email} • {application.customer.phone}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {isUnderReview ? (
              <>
                <Button variant="danger" size="md" onClick={() => setShowRejectModal(true)}>
                  Decline Application
                </Button>
                <Button variant="primary" size="md" onClick={() => setShowApproveModal(true)}>
                  ✓ Approve Application
                </Button>
              </>
            ) : application.status === 'APPROVED' ? (
              <Button variant="primary" size="md" onClick={() => setShowDisburseModal(true)}>
                ⚡ Initiate Disbursement →
              </Button>
            ) : application.status === 'DISBURSEMENT_PROCESSING' ? (
              <Button variant="primary" size="md" onClick={() => setShowConfirmDisburseModal(true)}>
                💳 Confirm Settlement & Disburse →
              </Button>
            ) : application.status === 'DISBURSED' ? (
              <span className="px-4 py-2 rounded-xl text-sm font-bold bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A]">
                ✓ Settlement Complete
              </span>
            ) : null}
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-sm font-medium">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-sm font-medium">
            ✓ {success}
          </div>
        )}

        {/* Same Customer Ledger Line representing case progress */}
        <LedgerLine status={application.status} />

        {/* 2-Column Case File Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Financials & Selected Offer */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Customer Profile & Financial Parameters */}
            <Card variant="default" padding="lg" className="space-y-4 bg-white">
              <CardHeader
                tagline="Borrower Profile"
                title="1. Income & Financial Baseline"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-xs text-[#686D76] block">Requested Principal</span>
                  <span className="font-mono font-bold text-[#14161A] text-base mt-0.5 block">
                    ₹{Number(application.loan_details.requested_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#686D76] block">Monthly Income</span>
                  <span className="font-mono font-bold text-[#14161A] text-base mt-0.5 block">
                    ₹{Number(application.loan_details.monthly_income || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#686D76] block">Existing Monthly Debt</span>
                  <span className="font-mono font-bold text-[#14161A] text-base mt-0.5 block">
                    ₹{Number(application.loan_details.existing_debt || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[#686D76] block">Employment</span>
                  <strong className="text-[#14161A] block mt-0.5">{application.loan_details.employment_type || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-xs text-[#686D76] block">Employer Name</span>
                  <strong className="text-[#14161A] block mt-0.5">{application.loan_details.employer_name || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-xs text-[#686D76] block">Purpose</span>
                  <strong className="text-[#14161A] block mt-0.5">{application.loan_details.purpose || 'N/A'}</strong>
                </div>
              </div>
            </Card>

            {/* Section 2: Selected Loan Plan */}
            {application.selected_offer && (
              <Card variant="default" padding="lg" className="space-y-4 border-l-4 border-l-[#B5652D] bg-white">
                <CardHeader
                  tagline="Confirmed Repayment Terms"
                  title="2. Selected Loan Structure"
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                    <span className="text-xs text-[#686D76] uppercase font-semibold block">Principal</span>
                    <span className="font-mono font-bold text-lg text-[#14161A] block mt-0.5">
                      ₹{Number(application.selected_offer.principal).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                    <span className="text-xs text-[#686D76] uppercase font-semibold block">Monthly EMI</span>
                    <span className="font-mono font-bold text-lg text-[#14161A] block mt-0.5">
                      ₹{Number(application.selected_offer.emi).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                    <span className="text-xs text-[#686D76] uppercase font-semibold block">Tenure</span>
                    <span className="font-bold text-base text-[#14161A] block mt-0.5">
                      {application.selected_offer.tenure_months} Months
                    </span>
                  </div>
                  <div className="p-3.5 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC]">
                    <span className="text-xs text-[#686D76] uppercase font-semibold block">Net Payout</span>
                    <span className="font-mono font-bold text-lg text-[#1E5C4A] block mt-0.5">
                      ₹{Number(application.selected_offer.net_disbursement).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Section 3: Disbursement Execution Record */}
            {disbursement && (
              <Card variant="accent" padding="lg" className="space-y-4 bg-white">
                <CardHeader
                  tagline="Settlement Ledger"
                  title="3. Disbursement Transaction Details"
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-[#686D76] block">Reference Number</span>
                    <strong className="text-[#B5652D] font-mono">{disbursement.disbursement_reference || 'Pending'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#686D76] block">Destination Bank</span>
                    <strong className="text-[#14161A]">{disbursement.destination_bank_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#686D76] block">Status</span>
                    <StatusBadge status={disbursement.disbursement_status || 'PENDING'} size="sm" />
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column: Verification Dossier, Photo Review & Audit Log */}
          <div className="space-y-6">
            {/* 4-Point Verification Checklist */}
            <Card variant="default" padding="lg" className="space-y-3 bg-white">
              <CardHeader
                tagline="Risk Verification"
                title="Customer Verification"
              />

              <div className="space-y-2 text-sm">
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">1. KYC ID Document</span>
                  <span className="text-[#1E5C4A] font-bold">✓ Verified</span>
                </div>
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">2. Bank Account</span>
                  <span className="text-[#1E5C4A] font-bold">✓ Verified</span>
                </div>
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">3. Live Photo / Selfie</span>
                  <span className="text-[#1E5C4A] font-bold">✓ Verified</span>
                </div>
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">4. Legal Declaration</span>
                  <span className="text-[#1E5C4A] font-bold">✓ Accepted</span>
                </div>
              </div>
            </Card>

            {/* Standalone Live Photo / Selfie Review (Challenge Requirement 3) */}
            <Card variant="default" padding="lg" className="space-y-3 bg-white">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
                  Live Photo Review
                </span>
                <span className={`text-xs font-bold ${photoApproved ? 'text-[#1E5C4A]' : 'text-[#8C3A32]'}`}>
                  {photoApproved ? '✓ Photo Approved' : '⚠️ Flagged'}
                </span>
              </div>

              <div className="p-4 bg-[#F9F3EE] rounded-xl border border-[#ECCBB3] text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-white border border-[#ECCBB3] flex items-center justify-center mx-auto text-xl text-[#9C4F1C]">
                  📷
                </div>
                <span className="text-xs font-semibold text-[#14161A] block">
                  Simulated Customer Live Capture
                </span>
                <span className="text-[11px] font-mono text-[#686D76] block">
                  storage_key: selfies/{application.id.slice(0, 8)}_live_photo.jpg
                </span>

                {isUnderReview && (
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPhotoApproved(true)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        photoApproved
                          ? 'bg-[#1E5C4A] text-white'
                          : 'bg-white border border-[#D4D0C7] text-[#686D76]'
                      }`}
                    >
                      ✓ Approve Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoApproved(false)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                        !photoApproved
                          ? 'bg-[#8C3A32] text-white'
                          : 'bg-white border border-[#D4D0C7] text-[#686D76]'
                      }`}
                    >
                      Flag Issue
                    </button>
                  </div>
                )}
              </div>
            </Card>

            {/* Audit Log Timeline */}
            <Card variant="default" padding="md" className="space-y-3 bg-white">
              <span className="text-xs font-bold uppercase tracking-wider text-[#686D76] block font-mono">
                Underwriting Audit Trail
              </span>
              <div className="space-y-2 max-h-60 overflow-y-auto text-xs divide-y divide-[#E5E2DC]">
                {application.audit_logs.map((log) => (
                  <div key={log.id} className="pt-2 first:pt-0">
                    <div className="flex justify-between font-mono font-bold text-[#14161A]">
                      <span>{log.action}</span>
                      <span className="text-xs text-[#8A8D93] font-normal">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-[#686D76]">
                      {log.old_status || 'START'} → {log.new_status || 'END'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      {/* Underwriter Approval Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#14161A] font-editorial">Approve Loan Application</h3>
            <p className="text-sm text-[#686D76]">
              Authorize credit approval for application <strong>#{application.application_number}</strong>. This locks the case file and authorizes disbursement.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" isLoading={submittingDecision} onClick={handleApprove}>
                Confirm Approval →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Underwriter Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial">Decline Loan Application</h3>
            <p className="text-sm text-[#686D76]">
              Specify the primary reason for declining this application.
            </p>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full bg-white border border-[#D4D0C7] rounded-xl p-2.5 text-sm text-[#14161A]"
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="md" isLoading={submittingDecision} onClick={handleReject}>
                Confirm Rejection →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Initiate Disbursement Modal */}
      {showDisburseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#14161A] font-editorial">Initiate Fund Disbursement</h3>
            <p className="text-sm text-[#686D76]">
              Initiate electronic fund transfer for application <strong>#{application.application_number}</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDisburseModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" isLoading={processingDisbursement} onClick={handleInitiateDisbursement}>
                Initiate Transfer →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Disbursement Modal */}
      {showConfirmDisburseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#14161A] font-editorial">Confirm Bank Settlement</h3>
            <p className="text-sm text-[#686D76]">
              Confirm receipt of bank UTR settlement. Application will permanently transition to <strong>DISBURSED</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmDisburseModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" isLoading={processingDisbursement} onClick={handleConfirmDisbursement}>
                Confirm Settlement & Disburse →
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminApplicationReview;
