import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchAdminApplicationDetail,
  reviewAdminKycDocument,
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
import { AdminLayout } from '../../components/layout/AdminLayout';
import { VerificationStatusBadge } from '../../components/ui/VerificationStatusBadge';
import { Card } from '../../components/ui/Card';
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
  const navigate = useNavigate();
  const [application, setApplication] = useState<AdminApplicationDetail | null>(null);
  const [, setDisbursement] = useState<DisbursementDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Live Photo Viewer & Lightbox State
  const [photoImageUrl, setPhotoImageUrl] = useState<string | null>(null);
  const [isReviewingPhoto, setIsReviewingPhoto] = useState<boolean>(false);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState<boolean>(false);
  const [photoZoom, setPhotoZoom] = useState<number>(1);
  const [showRetakeModal, setShowRetakeModal] = useState<boolean>(false);
  const [retakeReason, setRetakeReason] = useState<string>(
    'Please submit a clearer photo with your face fully visible and well-lit.'
  );

  // KYC Document Viewer & Modal State
  const [kycDocUrl, setKycDocUrl] = useState<string | null>(null);
  const [isReviewingKyc, setIsReviewingKyc] = useState<boolean>(false);
  const [showDocModal, setShowDocModal] = useState<boolean>(false);
  const [showKycRejectModal, setShowKycRejectModal] = useState<boolean>(false);
  const [kycRejectReason, setKycRejectReason] = useState<string>(
    'Please upload a clearer, uncropped identity document.'
  );

  // Decision & Disbursement Modals
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>(REJECTION_REASONS[0]);
  const [adminRemarks, setAdminRemarks] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);

  const [showDisburseModal, setShowDisburseModal] = useState<boolean>(false);
  const [showConfirmDisburseModal, setShowConfirmDisburseModal] = useState<boolean>(false);
  const [disburseRemarks, setDisburseRemarks] = useState<string>('');
  const [processingDisbursement, setProcessingDisbursement] = useState<boolean>(false);

  // Collapsible sections toggle
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);
  const [showOfferDetails, setShowOfferDetails] = useState<boolean>(false);

  // Keyboard shortcut listener for Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPhotoLightbox(false);
        setShowDocModal(false);
        setShowRetakeModal(false);
        setShowKycRejectModal(false);
        setShowApproveModal(false);
        setShowRejectModal(false);
        setShowDisburseModal(false);
        setShowConfirmDisburseModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch application detail & related resources
  const loadApplication = async (appId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAdminApplicationDetail(appId);
      setApplication(data);

      if (
        data.status === 'APPROVED' ||
        data.status === 'DISBURSEMENT_PROCESSING' ||
        data.status === 'DISBURSED'
      ) {
        try {
          const disb = await fetchAdminDisbursement(appId);
          setDisbursement(disb);
        } catch {
          // Non-critical
        }
      }

      // Fetch live photo preview
      if (data.verification?.selfie?.status) {
        try {
          const res = await apiClient.get(
            `/admin/applications/${appId}/verification/live-photo`,
            { responseType: 'blob' }
          );
          const blobUrl = URL.createObjectURL(res.data);
          setPhotoImageUrl(blobUrl);
        } catch {
          // Photo not yet available
        }
      }

      // Fetch KYC document preview
      if (data.verification?.kyc?.document_status && data.verification.kyc.document_status !== 'NOT_SUBMITTED') {
        try {
          const res = await apiClient.get(
            `/admin/applications/${appId}/verification/kyc-document`,
            { responseType: 'blob' }
          );
          const blobUrl = URL.createObjectURL(res.data);
          setKycDocUrl(blobUrl);
        } catch {
          // Doc not yet available
        }
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load underwriter case file.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadApplication(id);
    }
    return () => {
      if (photoImageUrl) URL.revokeObjectURL(photoImageUrl);
      if (kycDocUrl) URL.revokeObjectURL(kycDocUrl);
    };
  }, [id]);

  // ACTIONS: Live Photo Review
  const handleApprovePhoto = async () => {
    if (!application) return;
    setIsReviewingPhoto(true);
    setError(null);
    try {
      await reviewAdminSelfie(application.id, 'APPROVE');
      setSuccess('✓ Live Photo approved successfully.');
      setShowPhotoLightbox(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve live photo.'));
    } finally {
      setIsReviewingPhoto(false);
    }
  };

  const handleRequestRetake = async () => {
    if (!application) return;
    if (!retakeReason.trim()) {
      setError('Please provide a specific reason for requesting a photo retake.');
      return;
    }
    setIsReviewingPhoto(true);
    setError(null);
    try {
      await reviewAdminSelfie(application.id, 'REQUEST_RETAKE', retakeReason.trim());
      setSuccess('✓ Photo retake requested. Customer has been notified.');
      setShowRetakeModal(false);
      setShowPhotoLightbox(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to request photo retake.'));
    } finally {
      setIsReviewingPhoto(false);
    }
  };

  // ACTIONS: KYC Document Review
  const handleApproveKycDoc = async () => {
    if (!application) return;
    setIsReviewingKyc(true);
    setError(null);
    try {
      await reviewAdminKycDocument(application.id, 'APPROVE');
      setSuccess('✓ KYC Document approved successfully.');
      setShowDocModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve KYC document.'));
    } finally {
      setIsReviewingKyc(false);
    }
  };

  const handleRejectKycDoc = async () => {
    if (!application) return;
    if (!kycRejectReason.trim()) {
      setError('Please provide a specific reason for rejecting the KYC document.');
      return;
    }
    setIsReviewingKyc(true);
    setError(null);
    try {
      await reviewAdminKycDocument(application.id, 'REJECT', kycRejectReason.trim());
      setSuccess('✓ KYC Document replacement requested. Customer has been notified.');
      setShowKycRejectModal(false);
      setShowDocModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to reject KYC document.'));
    } finally {
      setIsReviewingKyc(false);
    }
  };

  // ACTIONS: Underwriting Decision (Approve / Reject Loan)
  const handleApproveDecision = async () => {
    if (!application) return;
    setSubmittingDecision(true);
    setError(null);
    try {
      await submitAdminDecision(application.id, {
        decision: 'APPROVED',
        remarks: adminRemarks.trim() || undefined,
      });
      setSuccess('✓ Loan application approved & sanctioned successfully.');
      setShowApproveModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to approve loan.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleRejectDecision = async () => {
    if (!application) return;
    setSubmittingDecision(true);
    setError(null);
    try {
      await submitAdminDecision(application.id, {
        decision: 'REJECTED',
        rejection_reason: rejectionReason,
        remarks: adminRemarks.trim() || undefined,
      });
      setSuccess('✓ Loan application marked as declined.');
      setShowRejectModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to decline application.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  // ACTIONS: Disbursement Processing
  const handleInitiateDisbursement = async () => {
    if (!application) return;
    setProcessingDisbursement(true);
    setError(null);
    try {
      await initiateAdminDisbursement(application.id, disburseRemarks.trim() || undefined);
      setSuccess('✓ Electronic disbursement initiated.');
      setShowDisburseModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to initiate disbursement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  const handleConfirmDisbursement = async () => {
    if (!application) return;
    setProcessingDisbursement(true);
    setError(null);
    try {
      await confirmAdminDisbursement(application.id);
      setSuccess('✓ Disbursement settled & completed.');
      setShowConfirmDisburseModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to confirm disbursement settlement.'));
    } finally {
      setProcessingDisbursement(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="py-24 text-center">
          <div className="animate-spin h-7 w-7 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs text-[#686D76]">Opening underwriting case file…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!application) {
    return (
      <AdminLayout>
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-[#8C3A32] font-semibold">Application case file not found.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
            ← Back to Queue
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const isUnderReview = application.status === 'UNDER_REVIEW';
  const isApproved = application.status === 'APPROVED';
  const isDisbursing = application.status === 'DISBURSEMENT_PROCESSING';
  const isDisbursed = application.status === 'DISBURSED';
  const isRejected = application.status === 'REJECTED';

  // Authoritative verification statuses
  const kycStatus =
    application.verification?.kyc?.document_status ||
    application.verification?.kyc?.status ||
    'NOT_SUBMITTED';

  const bankStatus =
    application.verification?.bank_account?.status ||
    'NOT_SUBMITTED';

  const selfieStatus =
    application.verification?.selfie?.status ||
    'NOT_SUBMITTED';

  const isDeclarationAccepted = !!application.verification?.declaration?.accepted;

  const isKycApproved =
    kycStatus === 'VERIFIED' || kycStatus === 'APPROVED' || kycStatus === 'KYC_VERIFIED';

  const isSelfieApproved =
    selfieStatus === 'PHOTO_APPROVED' || selfieStatus === 'VERIFIED';

  const isBankApproved =
    bankStatus === 'VERIFIED';

  // Decision Readiness Checklist
  const pendingChecks: string[] = [];
  if (!isKycApproved) {
    pendingChecks.push(
      kycStatus === 'FAILED' ? 'KYC Replacement Required' : 'KYC Document Approval Pending'
    );
  }
  if (!isBankApproved) {
    pendingChecks.push('Bank Account Penny Drop Pending');
  }
  if (!isSelfieApproved) {
    pendingChecks.push(
      selfieStatus === 'PHOTO_RETAKE_REQUIRED'
        ? 'Live Photo Retake Required'
        : 'Live Photo Approval Pending'
    );
  }
  if (!isDeclarationAccepted) {
    pendingChecks.push('Borrower Declaration Consent Pending');
  }

  const isReadyForSanction =
    isUnderReview && isKycApproved && isBankApproved && isSelfieApproved && isDeclarationAccepted;

  return (
    <AdminLayout activeFilter={application.status}>
      <div className="space-y-6 w-full pb-12">
        {/* ========================================================================= */}
        {/* 1. TOP CASE HEADER */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E5E2DC] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9C4F1C]">
                CASE #{application.application_number}
              </span>
              <span className="text-[#8A8D93]">•</span>
              <StatusBadge status={application.status} size="sm" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#14161A] font-editorial tracking-tight">
              {application.customer.full_name || 'Applicant'}
            </h1>
            <p className="text-xs text-[#686D76]">
              {application.customer.email} • {application.customer.phone} • Submitted on{' '}
              {new Date(application.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isUnderReview && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  className="text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC] text-xs font-semibold"
                >
                  ✕ Decline Loan
                </Button>
                <div className="relative group">
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!isReadyForSanction}
                    onClick={() => {
                      if (isReadyForSanction) {
                        setShowApproveModal(true);
                      }
                    }}
                    className={`${
                      isReadyForSanction
                        ? 'bg-[#1E5C4A] hover:bg-[#154437] text-white cursor-pointer'
                        : 'bg-[#D4D0C7] text-[#686D76] cursor-not-allowed opacity-75'
                    } text-xs font-bold shadow-2xs`}
                  >
                    {isReadyForSanction
                      ? '✓ Approve & Sanction Loan'
                      : !isKycApproved && !isSelfieApproved
                      ? 'KYC & Photo Approval Required'
                      : !isKycApproved
                      ? 'KYC Approval Required'
                      : !isSelfieApproved
                      ? 'Photo Approval Required'
                      : 'Verification Incomplete'}
                  </Button>
                  {!isReadyForSanction && (
                    <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-[#14161A] text-white text-[11px] rounded-lg shadow-lg hidden group-hover:block z-30 pointer-events-none">
                      <span className="font-bold block mb-1">Approval Blocked:</span>
                      {pendingChecks.map((chk, i) => (
                        <div key={i} className="text-[#EAE7E1]">• {chk}</div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {isApproved && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowDisburseModal(true)}
                className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white text-xs font-bold"
              >
                💸 Initiate Electronic Payout →
              </Button>
            )}

            {isDisbursing && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowConfirmDisburseModal(true)}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white text-xs font-bold"
              >
                ✓ Confirm Bank Settlement →
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin')}
              className="text-xs text-[#686D76] hover:text-[#14161A]"
            >
              ← Back to Queue
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs sm:text-sm flex items-center gap-2 shadow-2xs">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-xs sm:text-sm flex items-center gap-2 font-medium shadow-2xs">
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. BORROWER SNAPSHOT (COMPACT INTEGRATED GRID) */}
        {/* ========================================================================= */}
        <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9C4F1C]">
              BORROWER SNAPSHOT
            </span>
            <span className="text-[11px] text-[#8A8D93]">
              Application ID: {application.id}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            {/* Row 1: Core Financials */}
            <div>
              <span className="text-[#8A8D93] text-[11px] block">Requested Principal</span>
              <span className="text-base sm:text-lg font-mono font-bold text-[#14161A] block mt-0.5">
                ₹{Number(application.loan_details?.requested_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Monthly Income</span>
              <span className="text-base sm:text-lg font-mono font-bold text-[#14161A] block mt-0.5">
                ₹{Number(application.loan_details?.monthly_income || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Existing EMI Obligation</span>
              <span className="text-base sm:text-lg font-mono font-bold text-[#14161A] block mt-0.5">
                ₹{Number(application.loan_details?.existing_debt || 0).toLocaleString('en-IN')}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Repayment Tenure</span>
              <span className="text-base sm:text-lg font-bold text-[#14161A] block mt-0.5">
                {application.loan_details?.requested_tenure_months ?? 36} Months
              </span>
            </div>

            {/* Row 2: Employment & Risk Profile */}
            <div>
              <span className="text-[#8A8D93] text-[11px] block">Employment & Role</span>
              <span className="font-semibold text-[#14161A] block mt-0.5 truncate">
                {application.loan_details?.employment_type || 'SALARIED'}
              </span>
              <span className="text-[10px] text-[#686D76] block truncate">
                {application.loan_details?.employer_name || 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Loan Purpose</span>
              <span className="font-semibold text-[#14161A] block mt-0.5 truncate">
                {application.loan_details?.purpose || 'Personal Needs'}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Credit Assessment</span>
              <span className="text-base font-mono font-bold text-[#1E5C4A] block mt-0.5">
                {application.eligibility?.score ?? '750/900'}
              </span>
              <span className="text-[10px] text-[#686D76] block">
                DTI: {application.eligibility?.dti_ratio ? `${(Number(application.eligibility.dti_ratio) * 100).toFixed(1)}%` : 'Standard'}
              </span>
            </div>

            <div>
              <span className="text-[#8A8D93] text-[11px] block">Monthly Affordability</span>
              <span className="text-base font-mono font-bold text-[#14161A] block mt-0.5">
                {application.selected_offer?.emi
                  ? `₹${Number(application.selected_offer.emi).toLocaleString('en-IN')}`
                  : 'Eligible Tier'}
              </span>
            </div>
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 3. MAIN WORKSPACE: 2-COLUMN DESKTOP LAYOUT */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: VERIFICATION ITEMS & SECONDARY DETAILS (8 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#9C4F1C]">
                VERIFICATION DOSSIER
              </span>
              <span className="text-[11px] text-[#686D76]">
                Review all 4 compliance items before underwriting
              </span>
            </div>

            {/* A. KYC IDENTITY DOCUMENT */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🪪</span>
                  <span className="font-bold text-xs sm:text-sm text-[#14161A]">
                    1. KYC Identity Document
                  </span>
                </div>
                <VerificationStatusBadge status={kycStatus} size="sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#686D76]">
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Document Type:</span>
                  <strong className="text-[#14161A]">{application.verification?.kyc?.id_type || 'AADHAAR'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Government ID:</span>
                  <strong className="text-[#14161A] font-mono">{application.verification?.kyc?.id_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Name on Record:</span>
                  <strong className="text-[#14161A] truncate">{application.verification?.kyc?.full_name || application.customer.full_name || 'N/A'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>PDF Document:</span>
                  <strong className="text-[#14161A] font-mono truncate max-w-[140px]">
                    {application.verification?.kyc?.document_filename || 'kyc_document.pdf'}
                  </strong>
                </div>
              </div>

              {application.verification?.kyc?.document_rejection_reason && (
                <div className="p-2 bg-[#FBEFEC] rounded-xl text-[#8C3A32] text-xs">
                  Reason: &ldquo;{application.verification.kyc.document_rejection_reason}&rdquo;
                </div>
              )}

              {/* KYC Document Actions */}
              <div className="pt-2 border-t border-[#EAE7E1] flex items-center justify-between gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDocModal(true)}
                  className="text-xs"
                >
                  📄 View Full Document →
                </Button>

                {isUnderReview && (
                  <div className="flex items-center gap-2">
                    {isKycApproved ? (
                      <span className="text-xs font-bold text-[#1E5C4A] bg-[#E8F2EE] px-2.5 py-1 rounded-lg">
                        ✓ Approved
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowKycRejectModal(true)}
                          isLoading={isReviewingKyc}
                          className="text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC] text-xs"
                        >
                          Request Replacement
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleApproveKycDoc}
                          isLoading={isReviewingKyc}
                          className="bg-[#1E5C4A] hover:bg-[#154437] text-white text-xs"
                        >
                          Approve Document
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* B. DESTINATION BANK ACCOUNT */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🏦</span>
                  <span className="font-bold text-xs sm:text-sm text-[#14161A]">
                    2. Destination Bank Account
                  </span>
                </div>
                <VerificationStatusBadge status={bankStatus} size="sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#686D76]">
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Bank Name:</span>
                  <strong className="text-[#14161A] truncate">{application.verification?.bank_account?.bank_name || 'Verified Institution'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Account Number:</span>
                  <strong className="text-[#14161A] font-mono">{application.verification?.bank_account?.account_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>IFSC Code:</span>
                  <strong className="text-[#14161A] font-mono">{application.verification?.bank_account?.ifsc || 'N/A'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Penny Drop Match:</span>
                  <strong className="text-[#1E5C4A] font-semibold">✓ Verified Matching</strong>
                </div>
              </div>
            </Card>

            {/* C. LIVE PHOTO / SELFIE */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📷</span>
                  <span className="font-bold text-xs sm:text-sm text-[#14161A]">
                    3. Live Photo / Selfie
                  </span>
                </div>
                <VerificationStatusBadge status={selfieStatus} size="sm" />
              </div>

              <div className="flex items-start gap-3.5 text-xs text-[#686D76]">
                {/* Clickable Thumbnail */}
                <div
                  onClick={() => setShowPhotoLightbox(true)}
                  className="w-16 h-16 rounded-xl bg-[#FAF8F5] border border-[#E5E2DC] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#B5652D]/30 transition-all shadow-2xs group relative"
                >
                  {photoImageUrl ? (
                    <img
                      src={photoImageUrl}
                      alt="Customer live selfie"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-[10px] text-[#8A8D93]">No Photo</span>
                  )}
                  <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    🔍 Zoom
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex justify-between">
                    <span>Capture Mode:</span>
                    <strong className="text-[#14161A]">In-Browser Camera</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Submitted Date:</span>
                    <strong className="text-[#14161A]">
                      {application.verification?.selfie?.submitted_at
                        ? new Date(application.verification.selfie.submitted_at).toLocaleDateString('en-IN')
                        : 'Recently'}
                    </strong>
                  </div>
                  {application.verification?.selfie?.rejection_reason && (
                    <div className="p-1.5 bg-[#FBEFEC] rounded-lg text-[#8C3A32] text-[11px]">
                      Reason: &ldquo;{application.verification.selfie.rejection_reason}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Photo Actions */}
              <div className="pt-2 border-t border-[#EAE7E1] flex items-center justify-between gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPhotoLightbox(true)}
                  className="text-xs"
                >
                  🔍 View Photo →
                </Button>

                {isUnderReview && (
                  <div className="flex items-center gap-2">
                    {isSelfieApproved ? (
                      <span className="text-xs font-bold text-[#1E5C4A] bg-[#E8F2EE] px-2.5 py-1 rounded-lg">
                        ✓ Approved
                      </span>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRetakeModal(true)}
                          isLoading={isReviewingPhoto}
                          className="text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC] text-xs"
                        >
                          Request Retake
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleApprovePhoto}
                          isLoading={isReviewingPhoto}
                          className="bg-[#1E5C4A] hover:bg-[#154437] text-white text-xs"
                        >
                          Approve Photo
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* D. LEGAL DECLARATION */}
            <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">📜</span>
                  <span className="font-bold text-xs sm:text-sm text-[#14161A]">
                    4. Legal Declaration & Terms
                  </span>
                </div>
                <VerificationStatusBadge
                  status={isDeclarationAccepted ? 'ACCEPTED' : 'NOT_ACCEPTED'}
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#686D76]">
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Consent Status:</span>
                  <strong className="text-[#1E5C4A]">{isDeclarationAccepted ? '✓ Explicitly Agreed' : 'Pending'}</strong>
                </div>
                <div className="flex justify-between p-2 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span>Audit Signature:</span>
                  <strong className="text-[#14161A] font-mono text-[10px]">DIGITAL_AUDIT_LOGGED</strong>
                </div>
              </div>
            </Card>

            {/* SECONDARY COLLAPSIBLE: REPAYMENT PLAN & AUDIT TRAIL */}
            <div className="pt-2 space-y-3">
              {/* Repayment Plan Toggle */}
              {application.selected_offer && (
                <div className="border border-[#E5E2DC] bg-white rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowOfferDetails(!showOfferDetails)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-[#14161A] hover:bg-[#FAF8F5] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span>💰</span>
                      <span>Selected Repayment Plan & Interest Terms</span>
                    </div>
                    <span>{showOfferDetails ? '▲ Hide' : '▼ View Details'}</span>
                  </button>

                  {showOfferDetails && (
                    <div className="p-4 border-t border-[#EAE7E1] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#FAF8F5]">
                      <div>
                        <span className="text-[#686D76] block text-[11px]">Principal</span>
                        <strong className="font-mono text-sm text-[#14161A]">
                          ₹{Number(application.selected_offer.principal || 0).toLocaleString('en-IN')}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#686D76] block text-[11px]">Interest Rate</span>
                        <strong className="font-mono text-sm text-[#14161A]">
                          {Number(application.selected_offer.interest_rate || 0).toFixed(2)}% p.a.
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#686D76] block text-[11px]">Monthly EMI</span>
                        <strong className="font-mono text-sm text-[#14161A]">
                          ₹{application.selected_offer.emi ? Number(application.selected_offer.emi).toLocaleString('en-IN') : '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#686D76] block text-[11px]">Processing Fee + GST</span>
                        <strong className="font-mono text-sm text-[#14161A]">
                          ₹{Number(application.selected_offer.processing_fee || 0).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Audit Trail Toggle */}
              {application.audit_logs && application.audit_logs.length > 0 && (
                <div className="border border-[#E5E2DC] bg-white rounded-2xl overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setShowAuditTrail(!showAuditTrail)}
                    className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-[#14161A] hover:bg-[#FAF8F5] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span>🛡️</span>
                      <span>Cryptographic Audit Trail & State Transitions ({application.audit_logs.length})</span>
                    </div>
                    <span>{showAuditTrail ? '▲ Hide' : '▼ View Trail'}</span>
                  </button>

                  {showAuditTrail && (
                    <div className="p-4 border-t border-[#EAE7E1] space-y-2 max-h-56 overflow-y-auto bg-[#FAF8F5]">
                      {application.audit_logs.map((log: any, idx: number) => (
                        <div
                          key={log.id || idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#EAE7E1] text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-[#FAF3EE] text-[#B5652D] flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="font-bold text-[#14161A] font-mono">{log.new_status || log.action}</span>
                              {log.metadata?.remarks && (
                                <span className="text-[10px] text-[#686D76] block">
                                  Remarks: {log.metadata.remarks}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#8A8D93]">
                            {new Date(log.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: PERSISTENT STICKY CREDIT DECISION PANEL (4 COLS) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 sticky top-20 space-y-4">
            <Card
              variant="default"
              padding="lg"
              className="bg-white border-2 border-[#E5E2DC] shadow-xs rounded-2xl space-y-4"
            >
              <div className="border-b border-[#EAE7E1] pb-3">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#9C4F1C] block">
                  UNDERWRITING ASSESSMENT
                </span>
                <h3 className="text-base font-bold text-[#14161A] font-editorial mt-0.5">
                  Credit Decision
                </h3>
              </div>

              {/* Assessment Metrics */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76]">Credit Assessment:</span>
                  <strong className="font-mono text-sm text-[#1E5C4A]">
                    {application.eligibility?.score ?? '750/900'}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76]">Sanction Principal:</span>
                  <strong className="font-mono text-sm text-[#14161A]">
                    ₹{Number(application.selected_offer?.principal || application.loan_details?.requested_amount || 0).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76]">Monthly Income:</span>
                  <strong className="font-mono text-xs text-[#14161A]">
                    ₹{Number(application.loan_details?.monthly_income || 0).toLocaleString('en-IN')}
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                  <span className="text-[#686D76]">Existing Debt EMI:</span>
                  <strong className="font-mono text-xs text-[#14161A]">
                    ₹{Number(application.loan_details?.existing_debt || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Verification Checklist */}
              <div className="pt-2 border-t border-[#EAE7E1] space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#686D76] block">
                  Verification Status
                </span>

                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span>KYC Document</span>
                    <span className={isKycApproved ? 'text-[#1E5C4A] font-bold' : 'text-[#8C3A32] font-semibold'}>
                      {isKycApproved ? '✓ Verified' : kycStatus === 'FAILED' ? '⚠️ Replacement Req.' : '⏳ Under Review'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Bank Account</span>
                    <span className={isBankApproved ? 'text-[#1E5C4A] font-bold' : 'text-[#8C3A32] font-semibold'}>
                      {isBankApproved ? '✓ Verified' : '○ Not Verified'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Live Photo / Selfie</span>
                    <span className={isSelfieApproved ? 'text-[#1E5C4A] font-bold' : 'text-[#8C3A32] font-semibold'}>
                      {isSelfieApproved ? '✓ Approved' : selfieStatus === 'PHOTO_RETAKE_REQUIRED' ? '⚠️ Retake Req.' : '⏳ Pending Review'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Legal Declaration</span>
                    <span className={isDeclarationAccepted ? 'text-[#1E5C4A] font-bold' : 'text-[#8C3A32] font-semibold'}>
                      {isDeclarationAccepted ? '✓ Accepted' : '○ Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Decision Readiness Notice */}
              <div className="pt-2 border-t border-[#EAE7E1]">
                {isReadyForSanction ? (
                  <div className="p-3 bg-[#E8F2EE] rounded-xl border border-[#C5E0D5] text-[#1E5C4A] text-xs font-medium space-y-1">
                    <span className="font-bold block">✓ All Verification Checks Complete</span>
                    <p className="text-[11px] text-[#1E5C4A]/80">
                      Application satisfies all digital lending compliance rules. Ready for final loan sanction.
                    </p>
                  </div>
                ) : isApproved ? (
                  <div className="p-3 bg-[#E8F2EE] rounded-xl border border-[#C5E0D5] text-[#1E5C4A] text-xs font-medium">
                    <span className="font-bold block">✓ Loan Approved & Sanctioned</span>
                    <p className="text-[11px] mt-0.5">Ready for electronic bank disbursement.</p>
                  </div>
                ) : isDisbursing ? (
                  <div className="p-3 bg-[#FAF3EE] rounded-xl border border-[#F3D7C4] text-[#B5652D] text-xs font-medium">
                    <span className="font-bold block">💸 Payout Transfer in Progress</span>
                    <p className="text-[11px] mt-0.5">Awaiting IMPS/NEFT settlement confirmation.</p>
                  </div>
                ) : isDisbursed ? (
                  <div className="p-3 bg-[#E8F2EE] rounded-xl border border-[#C5E0D5] text-[#1E5C4A] text-xs font-medium">
                    <span className="font-bold block">✓ Payout Settled & Completed</span>
                    <p className="text-[11px] mt-0.5">Funds transferred to destination account.</p>
                  </div>
                ) : isRejected ? (
                  <div className="p-3 bg-[#FBEFEC] rounded-xl border border-[#F0D0CB] text-[#8C3A32] text-xs font-medium">
                    <span className="font-bold block">✕ Application Declined</span>
                    <p className="text-[11px] mt-0.5">Case closed in accordance with credit policy.</p>
                  </div>
                ) : (
                  <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1] text-xs text-[#686D76] space-y-1">
                    <span className="font-bold text-[#14161A] block">
                      ⚠️ {pendingChecks.length} Item(s) Pending Review
                    </span>
                    <ul className="text-[11px] list-disc list-inside space-y-0.5 text-[#8C3A32]">
                      {pendingChecks.map((chk, i) => (
                        <li key={i}>{chk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons in Decision Panel */}
              <div className="pt-2 border-t border-[#EAE7E1] space-y-2">
                {isUnderReview && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      size="md"
                      disabled={!isReadyForSanction}
                      onClick={() => {
                        if (isReadyForSanction) {
                          setShowApproveModal(true);
                        }
                      }}
                      className={`w-full ${
                        isReadyForSanction
                          ? 'bg-[#1E5C4A] hover:bg-[#154437] text-white cursor-pointer'
                          : 'bg-[#D4D0C7] text-[#686D76] cursor-not-allowed opacity-75'
                      } font-bold text-xs shadow-2xs`}
                    >
                      {isReadyForSanction
                        ? '✓ Approve & Sanction Loan'
                        : !isKycApproved && !isSelfieApproved
                        ? 'KYC & Photo Approval Required'
                        : !isKycApproved
                        ? 'KYC Approval Required'
                        : !isSelfieApproved
                        ? 'Photo Approval Required'
                        : 'Verification Incomplete'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRejectModal(true)}
                      className="w-full text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC] text-xs"
                    >
                      ✕ Decline Loan Application
                    </Button>
                  </div>
                )}

                {isApproved && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setShowDisburseModal(true)}
                    className="w-full bg-[#B5652D] hover:bg-[#9C4F1C] text-white font-bold text-xs"
                  >
                    💸 Initiate Electronic Payout →
                  </Button>
                )}

                {isDisbursing && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setShowConfirmDisburseModal(true)}
                    className="w-full bg-[#1E5C4A] hover:bg-[#154437] text-white font-bold text-xs"
                  >
                    ✓ Confirm Bank Settlement →
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FULL-SCREEN PDF / IMAGE DOCUMENT VIEWER (85–95% VIEWPORT) */}
      {/* ========================================================================= */}
      {showDocModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDocModal(false);
          }}
        >
          <div className="w-[92vw] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E2DC]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E5E2DC] flex items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <span className="text-xl">📄</span>
                <div>
                  <h3 className="font-bold text-base text-[#14161A] font-editorial">
                    KYC Supporting Identity Document Viewer
                  </h3>
                  <p className="text-xs text-[#686D76]">
                    Applicant: {application.customer.full_name || 'Applicant'} • ID:{' '}
                    <span className="font-mono font-bold text-[#14161A]">
                      {application.verification?.kyc?.id_number_masked || 'XXXX-XXXX-XXXX'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <VerificationStatusBadge status={kycStatus} size="sm" />
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="p-1.5 rounded-lg text-[#686D76] hover:bg-[#E5E2DC] text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 bg-[#1A1D20] p-4 flex items-center justify-center overflow-auto">
              {kycDocUrl ? (
                <iframe
                  src={kycDocUrl}
                  title="KYC Document Preview"
                  className="w-full h-full rounded-xl bg-white shadow-lg border-0"
                />
              ) : (
                <div className="text-center text-white space-y-2">
                  <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm">Loading identity document preview…</p>
                </div>
              )}
            </div>

            {/* Modal Action Footer */}
            <div className="px-6 py-3.5 border-t border-[#E5E2DC] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                {kycDocUrl && (
                  <a
                    href={kycDocUrl}
                    download={application.verification?.kyc?.document_filename || 'kyc_document.pdf'}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E2DC] bg-white text-xs font-semibold text-[#14161A] hover:bg-[#F2EFE9]"
                  >
                    ⬇ Download PDF Document
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowDocModal(false)}>
                  Close
                </Button>
                {isUnderReview && !isKycApproved && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKycRejectModal(true)}
                      className="text-[#8C3A32] border-[#F0D0CB]"
                    >
                      Request Replacement
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApproveKycDoc}
                      isLoading={isReviewingKyc}
                      className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
                    >
                      Approve Document
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FULL-SCREEN LIVE PHOTO LIGHTBOX WITH INTERACTIVE ZOOM */}
      {/* ========================================================================= */}
      {showPhotoLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoLightbox(false);
          }}
        >
          <div className="w-[90vw] max-w-4xl h-[85vh] bg-[#14161A] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#2D3139]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#2D3139] flex items-center justify-between bg-[#1C2026]">
              <div className="flex items-center gap-3">
                <span className="text-xl">📷</span>
                <div>
                  <h3 className="font-bold text-base text-white font-editorial">
                    Live Photo Verification Inspection
                  </h3>
                  <p className="text-xs text-[#8A8D93]">
                    Applicant: {application.customer.full_name || 'Applicant'} • Mode: In-Browser Camera
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <VerificationStatusBadge status={selfieStatus} size="sm" />
                <button
                  type="button"
                  onClick={() => setShowPhotoLightbox(false)}
                  className="p-1.5 rounded-lg text-[#8A8D93] hover:text-white hover:bg-[#2D3139] text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Photo Canvas */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-hidden relative">
              {photoImageUrl ? (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-200"
                  style={{ transform: `scale(${photoZoom})` }}
                >
                  <img
                    src={photoImageUrl}
                    alt="Applicant Live Capture"
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-[#2D3139]"
                  />
                </div>
              ) : (
                <div className="text-center text-[#8A8D93] space-y-2">
                  <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto" />
                  <p className="text-sm">Loading high-resolution photograph…</p>
                </div>
              )}

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#1C2026]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#2D3139] flex items-center gap-3 shadow-xl">
                <button
                  type="button"
                  onClick={() => setPhotoZoom((prev) => Math.max(0.5, prev - 0.25))}
                  className="text-white hover:text-[#B5652D] font-bold px-2 cursor-pointer"
                >
                  –
                </button>
                <span className="text-xs font-mono text-white min-w-[50px] text-center">
                  {Math.round(photoZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setPhotoZoom((prev) => Math.min(3, prev + 0.25))}
                  className="text-white hover:text-[#B5652D] font-bold px-2 cursor-pointer"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoZoom(1)}
                  className="text-[10px] text-[#8A8D93] hover:text-white px-1.5 py-0.5 rounded bg-[#2D3139] cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Lightbox Action Footer */}
            <div className="px-6 py-4 border-t border-[#2D3139] bg-[#1C2026] flex items-center justify-between">
              <span className="text-xs text-[#8A8D93]">
                Verify face clarity, lighting, and resemblance to government ID record.
              </span>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowPhotoLightbox(false)}>
                  Close
                </Button>
                {isUnderReview && !isSelfieApproved && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRetakeModal(true)}
                      className="text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC]"
                    >
                      Request Retake
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleApprovePhoto}
                      isLoading={isReviewingPhoto}
                      className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
                    >
                      Approve Photo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KYC REJECTION / REPLACEMENT REASON MODAL */}
      {/* ========================================================================= */}
      {showKycRejectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowKycRejectModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#14161A]">Request KYC Document Replacement</h3>
              <button
                type="button"
                onClick={() => setShowKycRejectModal(false)}
                className="text-[#8A8D93] hover:text-[#14161A] font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#686D76]">
              Provide a clear reason explaining why the uploaded document was rejected so the customer can upload a proper replacement.
            </p>
            <textarea
              rows={3}
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
              placeholder="E.g. Document image is blurry or edges are cropped..."
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowKycRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRejectKycDoc}
                isLoading={isReviewingKyc}
              >
                Send Replacement Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PHOTO RETAKE REASON MODAL */}
      {/* ========================================================================= */}
      {showRetakeModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRetakeModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-[#14161A]">Request Live Photo Retake</h3>
              <button
                type="button"
                onClick={() => setShowRetakeModal(false)}
                className="text-[#8A8D93] hover:text-[#14161A] font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#686D76]">
              Specify the remark explaining why the current live photograph cannot be approved.
            </p>
            <textarea
              rows={3}
              value={retakeReason}
              onChange={(e) => setRetakeReason(e.target.value)}
              placeholder="E.g. Face is partially shadowed or not centered in frame..."
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20 focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRetakeModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRequestRetake}
                isLoading={isReviewingPhoto}
              >
                Send Retake Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: APPROVE DECISION MODAL */}
      {/* ========================================================================= */}
      {showApproveModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowApproveModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <h3 className="font-bold text-base text-[#14161A]">Authorize Loan Approval & Sanction</h3>
            <p className="text-xs text-[#686D76]">
              You are authorizing credit approval for application #{application.application_number} in the amount of{' '}
              <strong className="text-[#14161A] font-mono font-bold">
                ₹{Number(application.selected_offer?.principal || application.loan_details?.requested_amount || 0).toLocaleString('en-IN')}
              </strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#14161A] mb-1">
                Underwriting Notes (Optional):
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="Applicant meets all risk policies and FOIR thresholds..."
                className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#1E5C4A]/20 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApproveDecision}
                isLoading={submittingDecision}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
              >
                Confirm Sanction
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: DECLINE LOAN MODAL */}
      {/* ========================================================================= */}
      {showRejectModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRejectModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <h3 className="font-bold text-base text-[#8C3A32]">Decline Loan Application</h3>
            <div>
              <label className="block text-xs font-semibold text-[#14161A] mb-1">
                Primary Reason for Decline:
              </label>
              <select
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20 focus:outline-none bg-white"
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#14161A] mb-1">
                Specific Underwriter Remarks (Optional):
              </label>
              <textarea
                rows={3}
                value={adminRemarks}
                onChange={(e) => setAdminRemarks(e.target.value)}
                placeholder="State policy guidelines or debt metrics that led to this decision..."
                className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRejectDecision}
                isLoading={submittingDecision}
              >
                Confirm Decline
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: INITIATE DISBURSEMENT MODAL */}
      {/* ========================================================================= */}
      {showDisburseModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDisburseModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <h3 className="font-bold text-base text-[#14161A]">Initiate Electronic Disbursement</h3>
            <p className="text-xs text-[#686D76]">
              Transfer funds electronically to verified bank account{' '}
              <strong className="font-mono text-[#14161A]">
                {application.verification?.bank_account?.account_number_masked || 'XXXX'}
              </strong>{' '}
              ({application.verification?.bank_account?.bank_name || 'Bank'}).
            </p>
            <div>
              <label className="block text-xs font-semibold text-[#14161A] mb-1">
                Treasury Notes / Payout Reference (Optional):
              </label>
              <input
                type="text"
                value={disburseRemarks}
                onChange={(e) => setDisburseRemarks(e.target.value)}
                placeholder="E.g. Batch #402 NEFT payout"
                className="w-full p-2.5 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#B5652D]/20 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDisburseModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleInitiateDisbursement}
                isLoading={processingDisbursement}
                className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white"
              >
                Execute Transfer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: CONFIRM DISBURSEMENT SETTLEMENT MODAL */}
      {/* ========================================================================= */}
      {showConfirmDisburseModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowConfirmDisburseModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl space-y-4 border border-[#E5E2DC]">
            <h3 className="font-bold text-base text-[#14161A]">Confirm Bank Settlement</h3>
            <p className="text-xs text-[#686D76]">
              Confirm that electronic bank transfer has cleared and mark loan application #{application.application_number} as{' '}
              <strong className="text-[#1E5C4A] font-bold">DISBURSED</strong>.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmDisburseModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDisbursement}
                isLoading={processingDisbursement}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
              >
                Confirm Settlement
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminApplicationReview;
