import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAdminApplicationDetail,
  reviewAdminSelfie,
  submitAdminDecision,
} from '../../lib/admin-api';
import apiClient from '../../lib/api-client';
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
  const [photoImageUrl, setPhotoImageUrl] = useState<string | null>(null);
  const [isReviewingPhoto, setIsReviewingPhoto] = useState<boolean>(false);
  const [showFullScreenPhotoModal, setShowFullScreenPhotoModal] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showRetakeModal, setShowRetakeModal] = useState<boolean>(false);
  const [retakeReason, setRetakeReason] = useState<string>(
    'Please submit a clearer photo with your face fully visible.'
  );

  // Decision Modals
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  // KYC Review Modals
  const [showKycRejectModal, setShowKycRejectModal] = useState<boolean>(false);
  const [kycRejectReason, setKycRejectReason] = useState<string>('Please upload a clearer, uncropped document.');
  const [isReviewingKyc, setIsReviewingKyc] = useState<boolean>(false);

  // Disbursement Modals
  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [showConfirmDisburseModal, setShowConfirmDisburseModal] = useState<boolean>(false);
  const [disburseRemarks, setDisburseRemarks] = useState<string>('');
  const [processingDisbursement, setProcessingDisbursement] = useState<boolean>(false);

  // Keyboard shortcut listener for Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFullScreenPhotoModal) setShowFullScreenPhotoModal(false);
        if (showRetakeModal) setShowRetakeModal(false);
        if (showApproveModal) setShowApproveModal(false);
        if (showRejectModal) setShowRejectModal(false);
        if (showKycRejectModal) setShowKycRejectModal(false);
        if (showDisburseModal) setShowDisburseModal(false);
        if (showConfirmDisburseModal) setShowConfirmDisburseModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showFullScreenPhotoModal,
    showRetakeModal,
    showApproveModal,
    showRejectModal,
    showKycRejectModal,
    showDisburseModal,
    showConfirmDisburseModal,
  ]);

  // Fetch photo binary securely
  useEffect(() => {
    if (application?.id) {
      apiClient
        .get(`/loans/applications/${application.id}/verification/live-photo`, {
          responseType: 'blob',
        })
        .then((res) => {
          const url = URL.createObjectURL(res.data);
          setPhotoImageUrl(url);
        })
        .catch((err) => {
          console.warn('Could not load live photo blob:', err);
        });
    }
  }, [application?.id]);

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
      setError(extractErrorMessage(err, 'Failed to complete disbursement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  const handleApprovePhoto = async () => {
    if (!id) return;
    try {
      setIsReviewingPhoto(true);
      setError(null);
      await reviewAdminSelfie(id, 'APPROVE');
      setSuccess('✓ Customer live photo approved successfully.');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve customer live photo.'));
    } finally {
      setIsReviewingPhoto(false);
    }
  };

  const handleRequestRetake = async () => {
    if (!id) return;
    try {
      setIsReviewingPhoto(true);
      setError(null);
      await reviewAdminSelfie(id, 'REQUEST_RETAKE', retakeReason);
      setSuccess('⚠️ Retake requested. Customer notified to submit a new clear photo.');
      setShowRetakeModal(false);
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to request photo retake.'));
    } finally {
      setIsReviewingPhoto(false);
    }
  };

  const handleViewKycDocument = async () => {
    if (!application?.id) return;
    try {
      const res = await apiClient.get(`/loans/applications/${application.id}/verification/kyc-document`, {
        responseType: 'blob',
      });
      const fileUrl = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(fileUrl, '_blank');
    } catch (err: any) {
      setError('Could not open KYC document. Please ensure a valid document is uploaded.');
    }
  };

  const handleApproveKycDocument = async () => {
    if (!id) return;
    try {
      setIsReviewingKyc(true);
      setError(null);
      await apiClient.post(`/admin/applications/${id}/kyc/review`, { action: 'APPROVE' });
      setSuccess('✓ KYC supporting document approved successfully.');
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve KYC document.'));
    } finally {
      setIsReviewingKyc(false);
    }
  };

  const handleRejectKycDocument = async () => {
    if (!id) return;
    try {
      setIsReviewingKyc(true);
      setError(null);
      await apiClient.post(`/admin/applications/${id}/kyc/review`, {
        action: 'REJECT',
        reason: kycRejectReason,
      });
      setSuccess('⚠️ KYC document rejected. Customer requested to upload a new document.');
      setShowKycRejectModal(false);
      await loadDetail();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to reject KYC document.'));
    } finally {
      setIsReviewingKyc(false);
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
            <Card variant="default" padding="lg" className="space-y-4 bg-white">
              <CardHeader
                tagline="Risk Verification"
                title="Customer Verification Dossier"
              />

              {/* 1. KYC Details & Supporting Document */}
              <div className="p-4 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#14161A] flex items-center gap-1.5">
                    <span>1. KYC Identity</span>
                    <span className="text-xs text-[#686D76]">({application.verification.kyc?.id_type || 'ID'})</span>
                  </span>
                  <span className="font-mono text-xs text-[#686D76]">
                    {application.verification.kyc?.id_number_masked || 'XXXX-XXXX-****'}
                  </span>
                </div>

                {application.verification.kyc && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#686D76] pt-1 border-t border-[#E5E2DC]">
                    <div>Name: <strong className="text-[#14161A]">{application.verification.kyc.full_name}</strong></div>
                    <div>DOB: <strong className="text-[#14161A]">{application.verification.kyc.date_of_birth}</strong></div>
                    <div className="col-span-2">
                      Address: <strong className="text-[#14161A]">{application.verification.kyc.address_line_1}, {application.verification.kyc.city}</strong>
                    </div>
                  </div>
                )}

                {/* Supporting PDF Document Details */}
                <div className="pt-2 border-t border-[#E5E2DC] flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#14161A] flex items-center gap-1">
                      <span>📄</span> Document:
                      <span className="font-normal text-[#686D76]">
                        {application.verification.kyc?.document_filename || 'No document uploaded'}
                      </span>
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        application.verification.kyc?.document_status === 'KYC_VERIFIED'
                          ? 'bg-[#E8F2EE] text-[#1E5C4A]'
                          : application.verification.kyc?.document_status === 'KYC_REJECTED'
                          ? 'bg-[#FBEFEC] text-[#8C3A32]'
                          : 'bg-[#F9F3EE] text-[#B5652D]'
                      }`}
                    >
                      {application.verification.kyc?.document_status?.replace(/_/g, ' ') || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleViewKycDocument}
                      className="px-2.5 py-1 bg-white border border-[#D4D0C7] hover:border-[#B5652D] rounded-lg text-xs font-semibold text-[#14161A] flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                    >
                      <span>👁️</span> View Document (PDF)
                    </button>

                    {isUnderReview && (
                      <>
                        <button
                          type="button"
                          onClick={handleApproveKycDocument}
                          disabled={isReviewingKyc}
                          className="px-2.5 py-1 bg-[#E8F2EE] hover:bg-[#D3E8DF] border border-[#C5E0D5] text-[#1E5C4A] rounded-lg text-xs font-bold cursor-pointer transition-all"
                        >
                          ✓ Approve Doc
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowKycRejectModal(true)}
                          disabled={isReviewingKyc}
                          className="px-2.5 py-1 bg-[#FBEFEC] hover:bg-[#F6DDD8] border border-[#F0D0CB] text-[#8C3A32] rounded-lg text-xs font-bold cursor-pointer transition-all"
                        >
                          ⚠️ Request Replace
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Destination Bank Account */}
              <div className="p-4 bg-[#F7F5F1] rounded-xl border border-[#E5E2DC] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#14161A] flex items-center gap-1.5">
                    <span>2. Disbursement Bank</span>
                  </span>
                  <span className="text-xs font-bold text-[#1E5C4A] bg-[#E8F2EE] px-2 py-0.5 rounded-full border border-[#C5E0D5]">
                    ✓ Verified
                  </span>
                </div>

                {application.verification.bank_account ? (
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#686D76] pt-1">
                    <div>Bank: <strong className="text-[#14161A]">{application.verification.bank_account.bank_name}</strong></div>
                    <div>IFSC: <strong className="text-[#14161A] font-mono">{application.verification.bank_account.ifsc}</strong></div>
                    <div>Account: <strong className="text-[#14161A] font-mono">{application.verification.bank_account.account_number_masked}</strong></div>
                    <div>Holder: <strong className="text-[#14161A]">{application.verification.bank_account.account_holder_name}</strong></div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8A8D93]">Bank details pending customer submission.</p>
                )}
              </div>

              {/* 3 & 4. Live Photo & Declaration Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">3. Live Photo</span>
                  <span className="text-[#1E5C4A] font-bold">
                    {application.verification.selfie?.status === 'PHOTO_APPROVED' ? '✓ Approved' : 'Submitted'}
                  </span>
                </div>
                <div className="p-3 bg-[#F7F5F1] rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-[#14161A]">4. Declaration</span>
                  <span className="text-[#1E5C4A] font-bold">✓ Accepted</span>
                </div>
              </div>
            </Card>

            {/* Real Live Photo / Selfie Review Card */}
            <Card variant="default" padding="lg" className="space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-[#E5E2DC] pb-2.5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono block">
                    LIVE PHOTO VERIFICATION
                  </span>
                  <span className="text-[11px] text-[#686D76]">
                    Submitted:{' '}
                    {application.verification.selfie?.submitted_at
                      ? new Date(application.verification.selfie.submitted_at).toLocaleString('en-IN')
                      : 'Recently'}
                  </span>
                </div>
                <div>
                  {application.verification.selfie?.status === 'PHOTO_APPROVED' ||
                  application.verification.selfie?.status === 'VERIFIED' ? (
                    <span className="text-xs font-bold px-2.5 py-1 bg-[#E8F5E9] text-[#1E5C4A] rounded-full border border-[#C5E0D5]">
                      ✓ Photo Approved
                    </span>
                  ) : application.verification.selfie?.status === 'PHOTO_RETAKE_REQUIRED' ? (
                    <span className="text-xs font-bold px-2.5 py-1 bg-[#FBEFEC] text-[#8C3A32] rounded-full border border-[#F0D0CB]">
                      ⚠️ Retake Required
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-1 bg-[#F9F3EE] text-[#B5652D] rounded-full border border-[#ECCBB3]">
                      ⏳ Pending Review
                    </span>
                  )}
                </div>
              </div>

              {/* Photo Display */}
              <div className="relative rounded-xl overflow-hidden bg-[#14161A] border border-[#E5E2DC] flex items-center justify-center min-h-[200px] group">
                {photoImageUrl ? (
                  <>
                    <img
                      src={photoImageUrl}
                      alt="Customer Live Selfie"
                      className="w-full h-56 object-contain bg-black/40 cursor-pointer"
                      onClick={() => {
                        setZoomLevel(1);
                        setShowFullScreenPhotoModal(true);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setZoomLevel(1);
                        setShowFullScreenPhotoModal(true);
                      }}
                      className="absolute top-2 right-2 px-2.5 py-1 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-semibold backdrop-blur-xs flex items-center gap-1 cursor-pointer transition-all border border-white/20 shadow-md"
                    >
                      <span>🔍</span>
                      <span>Full screen</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto text-xl">
                      📷
                    </div>
                    <span className="text-xs text-white/70 block">
                      Loading customer live capture...
                    </span>
                  </div>
                )}
              </div>

              {photoImageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setZoomLevel(1);
                    setShowFullScreenPhotoModal(true);
                  }}
                  className="w-full text-xs flex items-center justify-center gap-1.5"
                >
                  🔍 View full photo
                </Button>
              )}

              {/* Rejection / Retake Note if present */}
              {application.verification.selfie?.rejection_reason && (
                <div className="p-3 bg-[#FAF8F5] border border-[#F0D0CB] rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#8C3A32] block">Retake Guidance:</span>
                  <p className="text-[#686D76]">{application.verification.selfie.rejection_reason}</p>
                </div>
              )}

              {/* Action Buttons for Credit Officer */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isReviewingPhoto}
                  onClick={handleApprovePhoto}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    application.verification.selfie?.status === 'PHOTO_APPROVED' ||
                    application.verification.selfie?.status === 'VERIFIED'
                      ? 'bg-[#1E5C4A] text-white'
                      : 'bg-white border border-[#1E5C4A] text-[#1E5C4A] hover:bg-[#E8F5E9]'
                  }`}
                >
                  ✓ Approve Photo
                </button>
                <button
                  type="button"
                  disabled={isReviewingPhoto}
                  onClick={() => setShowRetakeModal(true)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    application.verification.selfie?.status === 'PHOTO_RETAKE_REQUIRED'
                      ? 'bg-[#8C3A32] text-white'
                      : 'bg-white border border-[#8C3A32] text-[#8C3A32] hover:bg-[#FBEFEC]'
                  }`}
                >
                  ⚠️ Request Retake
                </button>
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

      {/* Full-Screen Live Photo Review Modal / Lightbox */}
      {showFullScreenPhotoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFullScreenPhotoModal(false);
            }
          }}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/20 pb-3 mb-3 text-white">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-base">
                📷
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold font-editorial">
                  LIVE PHOTO VERIFICATION
                </h3>
                <p className="text-xs text-white/70">
                  Application #{application.application_number} • {application.customer.full_name || application.customer.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom Controls */}
              <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/20 text-xs">
                <button
                  type="button"
                  title="Zoom Out"
                  disabled={zoomLevel <= 0.6}
                  onClick={() => setZoomLevel((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="px-2.5 py-1 hover:bg-white/20 rounded-lg text-white font-mono font-bold cursor-pointer disabled:opacity-40"
                >
                  –
                </button>
                <span className="px-2 font-mono text-white/90">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  type="button"
                  title="Zoom In"
                  disabled={zoomLevel >= 3.0}
                  onClick={() => setZoomLevel((z) => Math.min(3.0, Number((z + 0.25).toFixed(2))))}
                  className="px-2.5 py-1 hover:bg-white/20 rounded-lg text-white font-mono font-bold cursor-pointer disabled:opacity-40"
                >
                  +
                </button>
                <button
                  type="button"
                  title="Reset Zoom"
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 ml-1 hover:bg-white/20 rounded-lg text-[10px] text-white/80 uppercase font-bold cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowFullScreenPhotoModal(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-lg cursor-pointer transition-all border border-white/20"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full-Screen Image Viewport */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-[300px]">
            {photoImageUrl ? (
              <img
                src={photoImageUrl}
                alt="Customer Full Live Capture"
                style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
                className="max-h-[70vh] max-w-[90vw] object-contain rounded-xl shadow-2xl origin-center select-none"
              />
            ) : (
              <div className="text-center text-white/60">Loading photo...</div>
            )}
          </div>

          {/* Metadata & Actions Footer Bar */}
          <div className="border-t border-white/20 pt-3 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-white/60 block uppercase font-mono text-[10px]">Submitted:</span>
                <span className="font-semibold">
                  {application.verification.selfie?.submitted_at
                    ? new Date(application.verification.selfie.submitted_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : 'Recently'}
                </span>
              </div>

              <div>
                <span className="text-white/60 block uppercase font-mono text-[10px]">Status:</span>
                <span className="font-bold text-amber-300 uppercase">
                  {application.verification.selfie?.status?.replace(/_/g, ' ') || 'PENDING REVIEW'}
                </span>
              </div>

              {application.verification.selfie?.rejection_reason && (
                <div className="max-w-md">
                  <span className="text-white/60 block uppercase font-mono text-[10px]">Previous Note:</span>
                  <span className="text-rose-300 truncate block">
                    {application.verification.selfie.rejection_reason}
                  </span>
                </div>
              )}
            </div>

            {/* Review Decision Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={isReviewingPhoto}
                onClick={() => {
                  setShowRetakeModal(true);
                }}
                className="flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-bold bg-[#8C3A32] hover:bg-[#A3433B] text-white cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                ⚠️ Request Retake
              </button>
              <button
                type="button"
                disabled={isReviewingPhoto}
                onClick={async () => {
                  await handleApprovePhoto();
                  setShowFullScreenPhotoModal(false);
                }}
                className="flex-1 sm:flex-initial py-2 px-5 rounded-xl text-xs font-bold bg-[#1E5C4A] hover:bg-[#164436] text-white cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md"
              >
                ✓ Approve Photo
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Underwriter Live Photo Retake Request Modal */}
      {showRetakeModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial">Request Photo Retake</h3>
            <p className="text-sm text-[#686D76]">
              Instruct the applicant to retake and resubmit their live photo. Specify instructions:
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#14161A] block">Common reasons:</label>
              <select
                onChange={(e) => {
                  if (e.target.value !== 'Other') {
                    setRetakeReason(e.target.value);
                  }
                }}
                className="w-full bg-white border border-[#D4D0C7] rounded-xl p-2 text-xs text-[#14161A]"
              >
                <option value="Please submit a clearer photo with your face fully visible.">Please submit a clearer photo with your face fully visible.</option>
                <option value="Face is not clearly visible">Face is not clearly visible</option>
                <option value="Image is too dark">Image is too dark</option>
                <option value="Photo is blurry">Photo is blurry</option>
                <option value="Face is partially outside the frame">Face is partially outside the frame</option>
                <option value="Other">Other (custom note below)</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={retakeReason}
              onChange={(e) => setRetakeReason(e.target.value)}
              placeholder="e.g. Please take a clear photo in good lighting with your face fully visible."
              className="w-full bg-white border border-[#D4D0C7] rounded-xl p-3 text-sm text-[#14161A] focus:outline-none focus:border-[#B5652D]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRetakeModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                isLoading={isReviewingPhoto}
                onClick={handleRequestRetake}
              >
                Send Retake Request →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Underwriter KYC Document Reject / Replacement Request Modal */}
      {showKycRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial">Request KYC Document Replacement</h3>
            <p className="text-sm text-[#686D76]">
              Instruct the applicant to upload a replacement KYC document. Specify rejection reason:
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#14161A] block">Reason:</label>
              <select
                onChange={(e) => {
                  if (e.target.value !== 'Other') {
                    setKycRejectReason(e.target.value);
                  }
                }}
                className="w-full bg-white border border-[#D4D0C7] rounded-xl p-2 text-xs text-[#14161A]"
              >
                <option value="Please upload a clearer, uncropped document.">Please upload a clearer, uncropped document.</option>
                <option value="Document text is unreadable or blurry.">Document text is unreadable or blurry.</option>
                <option value="Document name does not match applicant profile.">Document name does not match applicant profile.</option>
                <option value="Document is expired.">Document is expired.</option>
                <option value="Other">Other (custom note below)</option>
              </select>
            </div>
            <textarea
              rows={3}
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
              placeholder="e.g. Please upload a clear color PDF copy of your Aadhaar or PAN card."
              className="w-full bg-white border border-[#D4D0C7] rounded-xl p-3 text-sm text-[#14161A] focus:outline-none focus:border-[#B5652D]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowKycRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                isLoading={isReviewingKyc}
                onClick={handleRejectKycDocument}
              >
                Reject & Request Replacement →
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
