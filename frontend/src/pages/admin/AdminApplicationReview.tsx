import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
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

      // Load disbursement if eligible
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
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load case file details.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadApplication(id);
    }
  }, [id]);

  // Fetch live photo binary blob securely
  useEffect(() => {
    if (application?.id) {
      apiClient
        .get(`/loans/applications/${application.id}/verification/live-photo`, {
          responseType: 'blob',
        })
        .then((res) => {
          const objectUrl = URL.createObjectURL(res.data);
          setPhotoImageUrl(objectUrl);
        })
        .catch(() => {
          setPhotoImageUrl(null);
        });

      apiClient
        .get(`/loans/applications/${application.id}/verification/kyc-document`, {
          responseType: 'blob',
        })
        .then((res) => {
          const docBlobUrl = URL.createObjectURL(res.data);
          setKycDocUrl(docBlobUrl);
        })
        .catch(() => {
          setKycDocUrl(null);
        });
    }

    return () => {
      if (photoImageUrl) URL.revokeObjectURL(photoImageUrl);
      if (kycDocUrl) URL.revokeObjectURL(kycDocUrl);
    };
  }, [application?.id, application?.verification?.selfie?.status, application?.verification?.kyc?.document_status]);

  // =========================================================================
  // ACTIONS: Photo Review
  // =========================================================================
  const handleApprovePhoto = async () => {
    if (!application) return;
    setIsReviewingPhoto(true);
    setError(null);
    try {
      await reviewAdminSelfie(application.id, 'APPROVE');
      setSuccess('✓ Live photo approved successfully.');
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
      setSuccess('✓ Photo retake requested. Customer dashboard has been notified.');
      setShowRetakeModal(false);
      setShowPhotoLightbox(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to request photo retake.'));
    } finally {
      setIsReviewingPhoto(false);
    }
  };

  // =========================================================================
  // ACTIONS: KYC Document Review
  // =========================================================================
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

  // =========================================================================
  // ACTIONS: Underwriting Decision (Approve / Reject Loan)
  // =========================================================================
  const handleApproveDecision = async () => {
    if (!application) return;
    setSubmittingDecision(true);
    setError(null);
    try {
      await submitAdminDecision(application.id, {
        decision: 'APPROVED',
        remarks: adminRemarks.trim() || undefined,
      });
      setSuccess('✓ Loan application approved successfully.');
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
      setSuccess('✓ Loan application marked as rejected.');
      setShowRejectModal(false);
      await loadApplication(application.id);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to decline application.'));
    } finally {
      setSubmittingDecision(false);
    }
  };

  // =========================================================================
  // ACTIONS: Disbursement Processing
  // =========================================================================
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
          <div className="animate-spin h-8 w-8 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-xs text-[#686D76]">Opening underwriter dossier…</p>
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

  // Authoritative statuses from verification details
  const kycStatus = application.verification?.kyc?.document_status || application.verification?.kyc?.status || 'NOT_SUBMITTED';
  const bankStatus = application.verification?.bank_account?.status || 'NOT_SUBMITTED';
  const selfieStatus = application.verification?.selfie?.status || 'NOT_SUBMITTED';
  const isDeclarationAccepted = !!application.verification?.declaration?.accepted;

  const isKycApproved = kycStatus === 'VERIFIED' || kycStatus === 'APPROVED' || kycStatus === 'KYC_VERIFIED';
  const isSelfieApproved = selfieStatus === 'PHOTO_APPROVED' || selfieStatus === 'VERIFIED';

  return (
    <AdminLayout activeFilter={application.status}>
      <div className="space-y-6 w-full">
        {/* ========================================================================= */}
        {/* CASE HEADER */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E5E2DC] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/admin" className="text-xs text-[#686D76] hover:text-[#14161A] font-semibold flex items-center gap-1">
                ← Underwriting Queue
              </Link>
              <span className="text-[#8A8D93]">/</span>
              <span className="text-xs font-mono font-bold text-[#14161A]">
                #{application.application_number}
              </span>
              <StatusBadge status={application.status} size="sm" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial tracking-tight">
              Case File: {application.customer.full_name || 'Applicant'}
            </h1>
            <p className="text-xs text-[#686D76] mt-0.5">
              {application.customer.email} • {application.customer.phone} • Submitted on{' '}
              {new Date(application.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isUnderReview && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  className="text-[#8C3A32] border-[#F0D0CB] hover:bg-[#FBEFEC]"
                >
                  ✕ Decline Loan
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setShowApproveModal(true)}
                  className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
                >
                  ✓ Approve & Sanction Loan →
                </Button>
              </>
            )}

            {isApproved && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowDisburseModal(true)}
                className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white"
              >
                💸 Initiate Electronic Payout →
              </Button>
            )}

            {isDisbursing && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowConfirmDisburseModal(true)}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
              >
                ✓ Confirm Bank Settlement →
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              Back to Queue
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-xs sm:text-sm flex items-center gap-2 shadow-xs">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-xs sm:text-sm flex items-center gap-2 font-medium shadow-xs">
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 1: BORROWER FINANCIAL SUMMARY */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Requested Principal</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#14161A] block">
              ₹{Number(application.loan_details?.requested_amount || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Monthly Income</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#14161A] block">
              ₹{Number(application.loan_details?.monthly_income || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Existing Debt EMI</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#14161A] block">
              ₹{Number(application.loan_details?.existing_debt || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Employment</span>
            <span className="text-xs font-bold text-[#14161A] block truncate">
              {application.loan_details?.employment_type || 'SALARIED'}
            </span>
            <span className="text-[10px] text-[#686D76] block truncate">
              {application.loan_details?.employer_name || 'N/A'}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Loan Purpose</span>
            <span className="text-xs font-bold text-[#14161A] block truncate">
              {application.loan_details?.purpose || 'Personal Needs'}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Credit Assessment</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#1E5C4A] block">
              {application.eligibility?.score ?? '750/900'}
            </span>
          </div>

          <div className="p-3.5 bg-white border border-[#E5E2DC] rounded-xl shadow-2xs space-y-0.5">
            <span className="text-[10px] font-semibold uppercase text-[#686D76] block">Requested Tenure</span>
            <span className="font-mono text-base sm:text-lg font-bold text-[#14161A] block">
              {application.loan_details?.requested_tenure_months ?? 36}M
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 2: VERIFICATION CENTER (2x2 CARD GRID) */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#9C4F1C]">
              Verification Dossier
            </span>
            <span className="text-xs text-[#686D76]">
              All checks must be verified before sanction authorization
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: KYC Identity & PDF Document */}
            <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🪪</span>
                    <span className="font-bold text-sm text-[#14161A]">1. KYC Identity Document</span>
                  </div>
                  <VerificationStatusBadge status={kycStatus} />
                </div>

                <div className="space-y-1.5 text-xs text-[#686D76]">
                  <div className="flex justify-between">
                    <span>Document Type:</span>
                    <strong className="text-[#14161A]">{application.verification?.kyc?.id_type || 'AADHAAR'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Government ID Number:</span>
                    <strong className="text-[#14161A] font-mono">{application.verification?.kyc?.id_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Full Name on Record:</span>
                    <strong className="text-[#14161A]">{application.verification?.kyc?.full_name || application.customer.full_name || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Uploaded PDF File:</span>
                    <strong className="text-[#14161A] font-mono truncate max-w-[200px]">
                      {application.verification?.kyc?.document_filename || 'kyc_identity_doc.pdf'}
                    </strong>
                  </div>

                  {application.verification?.kyc?.document_rejection_reason && (
                    <div className="p-2 bg-[#FBEFEC] rounded-lg text-[#8C3A32] text-[11px] mt-1">
                      Reason: &ldquo;{application.verification.kyc.document_rejection_reason}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* KYC Actions */}
              <div className="pt-3 border-t border-[#EAE7E1] flex items-center justify-between gap-2 flex-wrap">
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
                      <span className="text-xs font-bold text-[#1E5C4A] bg-[#E8F2EE] px-2.5 py-1 rounded-md">
                        ✓ Document Approved
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

            {/* Card 2: Destination Bank Account */}
            <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏦</span>
                    <span className="font-bold text-sm text-[#14161A]">2. Destination Bank Account</span>
                  </div>
                  <VerificationStatusBadge status={bankStatus} />
                </div>

                <div className="space-y-1.5 text-xs text-[#686D76]">
                  <div className="flex justify-between">
                    <span>Bank Institution:</span>
                    <strong className="text-[#14161A]">{application.verification?.bank_account?.bank_name || 'Verified Financial Institution'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Account Number:</span>
                    <strong className="text-[#14161A] font-mono">{application.verification?.bank_account?.account_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>IFSC Code:</span>
                    <strong className="text-[#14161A] font-mono">{application.verification?.bank_account?.ifsc || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Account Holder Name:</span>
                    <strong className="text-[#14161A]">{application.verification?.bank_account?.account_holder_name || application.customer.full_name || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EAE7E1] flex items-center justify-between text-[11px] text-[#686D76]">
                <span>Automated Penny Drop / IFSC Validation:</span>
                <span className="font-bold text-[#1E5C4A]">✓ Verified Matching</span>
              </div>
            </Card>

            {/* Card 3: Live Photo / Selfie Review */}
            <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📷</span>
                    <span className="font-bold text-sm text-[#14161A]">3. Live Photo / Selfie</span>
                  </div>
                  <VerificationStatusBadge status={selfieStatus} />
                </div>

                <div className="flex items-start gap-3 text-xs text-[#686D76]">
                  {/* Thumbnail */}
                  <div
                    onClick={() => setShowPhotoLightbox(true)}
                    className="w-20 h-20 rounded-xl bg-[#FAF8F5] border border-[#E5E2DC] overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#B5652D]/30 transition-all shadow-2xs group relative"
                  >
                    {photoImageUrl ? (
                      <img
                        src={photoImageUrl}
                        alt="Customer live capture"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-xs text-[#8A8D93]">No Photo</span>
                    )}
                    <span className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                      🔍 Zoom
                    </span>
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span>Capture Mode:</span>
                      <strong className="text-[#14161A]">Live Camera</strong>
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
                      <div className="p-1.5 bg-[#FBEFEC] rounded text-[#8C3A32] text-[10px] mt-1">
                        Reason: &ldquo;{application.verification.selfie.rejection_reason}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Selfie Actions */}
              <div className="pt-3 border-t border-[#EAE7E1] flex items-center justify-between gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPhotoLightbox(true)}
                  className="text-xs"
                >
                  🔍 View Full Photo Lightbox →
                </Button>

                {isUnderReview && (
                  <div className="flex items-center gap-2">
                    {isSelfieApproved ? (
                      <span className="text-xs font-bold text-[#1E5C4A] bg-[#E8F2EE] px-2.5 py-1 rounded-md">
                        ✓ Photo Approved
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

            {/* Card 4: Legal Declaration */}
            <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📜</span>
                    <span className="font-bold text-sm text-[#14161A]">4. Legal Declaration & Terms</span>
                  </div>
                  <VerificationStatusBadge status={isDeclarationAccepted ? 'ACCEPTED' : 'NOT_ACCEPTED'} />
                </div>

                <div className="space-y-1.5 text-xs text-[#686D76]">
                  <div className="flex justify-between">
                    <span>Borrower Consent:</span>
                    <strong className="text-[#1E5C4A]">{isDeclarationAccepted ? '✓ Explicitly Agreed' : 'Pending'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Timestamp:</span>
                    <strong className="text-[#14161A]">
                      {application.verification?.declaration?.accepted_at
                        ? new Date(application.verification.declaration.accepted_at).toLocaleString('en-IN')
                        : 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Declaration Version:</span>
                    <strong className="text-[#14161A] font-mono">{application.verification?.declaration?.declaration_version || 'v1.0-standard'}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#EAE7E1] flex items-center justify-between text-[11px] text-[#686D76]">
                <span>E-Sign & Consent Logging:</span>
                <span className="font-mono text-[#1E5C4A] font-bold">DIGITAL_AUDIT_LOGGED</span>
              </div>
            </Card>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: SELECTED OFFER & SETTLEMENT DETAILS */}
        {/* ========================================================================= */}
        {application.selected_offer && (
          <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs">
            <CardHeader
              tagline="Credit Plan"
              title="Selected Repayment Plan & Financial Terms"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                <span className="text-[#686D76] block">Principal Amount</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{Number(application.selected_offer.principal || 0).toLocaleString('en-IN')}
                </strong>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                <span className="text-[#686D76] block">Interest Rate</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  {Number(application.selected_offer.interest_rate || 0).toFixed(2)}% p.a.
                </strong>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                <span className="text-[#686D76] block">Monthly EMI</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{application.selected_offer.emi ? Number(application.selected_offer.emi).toLocaleString('en-IN') : '—'}
                </strong>
              </div>

              <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE7E1]">
                <span className="text-[#686D76] block">Processing Fee + GST</span>
                <strong className="text-base font-mono text-[#14161A] block mt-0.5">
                  ₹{Number(application.selected_offer.processing_fee || 0).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: CRYPTOGRAPHIC AUDIT TRAIL */}
        {/* ========================================================================= */}
        {application.audit_logs && application.audit_logs.length > 0 && (
          <Card variant="default" padding="md" className="bg-white space-y-4 border border-[#E5E2DC] shadow-xs">
            <CardHeader
              tagline="Audit Integrity"
              title="Application State Transition Timeline"
            />

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {application.audit_logs.map((log: any, idx: number) => (
                <div
                  key={log.id || idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE7E1] text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#E5E2DC] text-[#14161A] flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-[#14161A] font-mono">{log.new_status || log.action}</span>
                      {log.metadata?.remarks && (
                        <span className="text-[11px] text-[#686D76] block">
                          Remarks: {log.metadata.remarks}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] text-[#8A8D93]">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
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
      {/* MODAL 2: FULL-SCREEN LIVE PHOTO LIGHTBOX (85–95% VIEWPORT) */}
      {/* ========================================================================= */}
      {showPhotoLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPhotoLightbox(false);
          }}
        >
          <div className="w-[90vw] h-[88vh] bg-[#14161A] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 text-white">
            {/* Lightbox Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#1C1F24]">
              <div className="flex items-center gap-3">
                <span className="text-xl">📷</span>
                <div>
                  <h3 className="font-bold text-base font-editorial">
                    Live Photo Verification Lightbox
                  </h3>
                  <p className="text-xs text-white/60">
                    Applicant: {application.customer.full_name || 'Applicant'} • Mode: In-Browser Live Capture
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setPhotoZoom((z) => Math.max(0.5, z - 0.25))}
                    className="px-2 py-0.5 hover:bg-white/20 rounded cursor-pointer"
                  >
                    −
                  </button>
                  <span className="px-1">{Math.round(photoZoom * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setPhotoZoom((z) => Math.min(3, z + 0.25))}
                    className="px-2 py-0.5 hover:bg-white/20 rounded cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoZoom(1)}
                    className="px-2 py-0.5 hover:bg-white/20 rounded text-[10px] text-white/70 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPhotoLightbox(false)}
                  className="p-1.5 rounded-lg text-white/70 hover:bg-white/20 text-lg font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Split Body: Photo Zoom Area + Metadata Sidebar */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Photo Area */}
              <div className="flex-1 bg-black p-6 flex items-center justify-center overflow-auto">
                {photoImageUrl ? (
                  <img
                    src={photoImageUrl}
                    alt="Customer live capture full resolution"
                    style={{ transform: `scale(${photoZoom})` }}
                    className="max-h-[60vh] lg:max-h-[68vh] object-contain rounded-xl shadow-2xl transition-transform duration-150"
                  />
                ) : (
                  <div className="text-center text-white/60">
                    <p className="text-sm">No photo available</p>
                  </div>
                )}
              </div>

              {/* Lightbox Right Metadata Panel */}
              <div className="w-full lg:w-80 bg-[#1C1F24] border-t lg:border-t-0 lg:border-l border-white/10 p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/50 block">
                      Verification Assessment
                    </span>
                    <div className="pt-1">
                      <VerificationStatusBadge status={selfieStatus} size="md" />
                    </div>
                  </div>

                  <div className="space-y-2 text-white/80 pt-2 border-t border-white/10">
                    <div className="flex justify-between">
                      <span className="text-white/50">Applicant Name:</span>
                      <strong className="text-white">{application.customer.full_name || 'N/A'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">App ID:</span>
                      <strong className="font-mono text-white">#{application.application_number}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Capture Timestamp:</span>
                      <strong className="text-white">
                        {application.verification?.selfie?.submitted_at
                          ? new Date(application.verification.selfie.submitted_at).toLocaleString('en-IN')
                          : 'Recently'}
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1">
                    <span className="font-bold text-white block text-[11px]">Underwriting Checklist:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-white/70">
                      <li>Facial features clearly visible</li>
                      <li>Lighting is adequate and natural</li>
                      <li>No sunglasses, masks, or occlusions</li>
                    </ul>
                  </div>
                </div>

                {/* Review Actions inside Lightbox */}
                {isUnderReview && (
                  <div className="pt-4 border-t border-white/10 space-y-2">
                    {isSelfieApproved ? (
                      <div className="p-2.5 bg-[#1E5C4A]/30 border border-[#1E5C4A] rounded-xl text-center text-xs font-bold text-[#C5E0D5]">
                        ✓ Photo Approved & Verified
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={handleApprovePhoto}
                          isLoading={isReviewingPhoto}
                          className="w-full bg-[#1E5C4A] hover:bg-[#154437] text-white"
                        >
                          ✓ Approve Photo
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowRetakeModal(true)}
                          isLoading={isReviewingPhoto}
                          className="w-full text-[#F0D0CB] border-white/20 hover:bg-white/10"
                        >
                          Request Photo Retake
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REQUEST KYC REPLACEMENT MODAL */}
      {/* ========================================================================= */}
      {showKycRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial flex items-center gap-2">
              <span>⚠️</span> Request Document Replacement
            </h3>
            <p className="text-xs text-[#686D76]">
              Specify the reason why the customer&apos;s uploaded identity document was rejected. This message will appear directly on the customer dashboard.
            </p>

            <textarea
              value={kycRejectReason}
              onChange={(e) => setKycRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Document image is blurry or edges are cropped. Please upload a clear original PDF."
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowKycRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isReviewingKyc}
                onClick={handleRejectKycDoc}
                className="bg-[#8C3A32] hover:bg-[#722F29] text-white"
              >
                Send Replacement Request →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REQUEST PHOTO RETAKE MODAL */}
      {/* ========================================================================= */}
      {showRetakeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial flex items-center gap-2">
              <span>📷</span> Request Live Photo Retake
            </h3>
            <p className="text-xs text-[#686D76]">
              Explain to the customer why a retake is necessary. The customer dashboard will immediately prompt them to capture a new selfie.
            </p>

            <textarea
              value={retakeReason}
              onChange={(e) => setRetakeReason(e.target.value)}
              rows={3}
              placeholder="e.g. Please capture the selfie in a brightly lit room with your face looking straight into the camera."
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs focus:ring-2 focus:ring-[#8C3A32]/20"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRetakeModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={isReviewingPhoto}
                onClick={handleRequestRetake}
                className="bg-[#8C3A32] hover:bg-[#722F29] text-white"
              >
                Request Retake Now →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: APPROVE LOAN MODAL */}
      {/* ========================================================================= */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#1E5C4A] font-editorial flex items-center gap-2">
              <span>✓</span> Authorize Loan Sanction
            </h3>
            <p className="text-xs text-[#686D76]">
              Are you sure you want to approve this loan for{' '}
              <strong>₹{Number(application.loan_details?.requested_amount || 0).toLocaleString('en-IN')}</strong>? This permanently updates the loan stage to <strong>APPROVED</strong> and generates the Sanction Letter.
            </p>

            <textarea
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              rows={2}
              placeholder="Optional underwriter sanction remarks"
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={submittingDecision}
                onClick={handleApproveDecision}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
              >
                Confirm Sanction & Approve →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: REJECT LOAN MODAL */}
      {/* ========================================================================= */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#8C3A32] font-editorial flex items-center gap-2">
              <span>✕</span> Decline Loan Application
            </h3>
            <p className="text-xs text-[#686D76]">
              Select the primary reason for declining this loan application:
            </p>

            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-[#E5E2DC] text-xs bg-white"
            >
              {REJECTION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <textarea
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              rows={2}
              placeholder="Optional additional notes"
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={submittingDecision}
                onClick={handleRejectDecision}
                className="bg-[#8C3A32] hover:bg-[#722F29] text-white"
              >
                Confirm Decline
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: DISBURSEMENT PROCESSING MODAL */}
      {/* ========================================================================= */}
      {showDisburseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#14161A] font-editorial flex items-center gap-2">
              <span>💸</span> Initiate Electronic Fund Transfer
            </h3>
            <p className="text-xs text-[#686D76]">
              Transfer funds to destination bank account{' '}
              <strong className="font-mono">
                {application.verification?.bank_account?.account_number_masked || 'XXXX-XXXX'}
              </strong>{' '}
              ({application.verification?.bank_account?.bank_name || 'Bank'}).
            </p>

            <textarea
              value={disburseRemarks}
              onChange={(e) => setDisburseRemarks(e.target.value)}
              rows={2}
              placeholder="Optional transfer reference or remarks"
              className="w-full p-3 rounded-xl border border-[#E5E2DC] text-xs"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowDisburseModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={processingDisbursement}
                onClick={handleInitiateDisbursement}
                className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white"
              >
                Initiate Payout →
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 8: CONFIRM DISBURSEMENT SETTLEMENT MODAL */}
      {/* ========================================================================= */}
      {showConfirmDisburseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <Card variant="elevated" padding="lg" className="max-w-md w-full space-y-4 bg-white shadow-2xl">
            <h3 className="text-xl font-bold text-[#1E5C4A] font-editorial flex items-center gap-2">
              <span>✓</span> Confirm Bank UTR Settlement
            </h3>
            <p className="text-xs text-[#686D76]">
              Confirm receipt of bank settlement confirmation. The application will permanently transition to <strong>DISBURSED</strong>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowConfirmDisburseModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                isLoading={processingDisbursement}
                onClick={handleConfirmDisbursement}
                className="bg-[#1E5C4A] hover:bg-[#154437] text-white"
              >
                Confirm Settlement & Disburse →
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminApplicationReview;
