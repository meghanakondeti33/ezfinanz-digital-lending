import React, { useState, useEffect } from 'react';
import type {
  BankAccountData,
  DeclarationData,
  Gender,
  IDType,
  KYCData,
  SelfieData,
  VerificationSummary,
} from '../../types/verification';
import {
  fetchBankAccount,
  fetchDeclaration,
  fetchKYC,
  fetchSelfie,
  fetchVerificationSummary,
  submitBankAccount,
  submitDeclaration,
  submitKYC,
  uploadKYCDocument,
} from '../../lib/verification-api';
import { extractErrorMessage } from '../../lib/error-utils';
import { SUPPORTED_BANKS, validateBankIfsc } from '../../lib/banks';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import SelfieCameraCapture from './SelfieCameraCapture';

interface VerificationWizardProps {
  applicationId: string;
  initialStep?: number;
  initialMode?: 'retake' | 'capture';
  onVerificationComplete?: () => void;
}

export const VerificationWizard: React.FC<VerificationWizardProps> = ({
  applicationId,
  initialStep,
  initialMode,
  onVerificationComplete,
}) => {
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStep, setActiveStep] = useState<number>(initialStep || 1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Verification step entities
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [bankData, setBankData] = useState<BankAccountData | null>(null);
  const [selfieData, setSelfieData] = useState<SelfieData | null>(null);
  const [declarationData, setDeclarationData] = useState<DeclarationData | null>(null);

  // KYC Document Upload State
  const [uploadingKycDoc, setUploadingKycDoc] = useState<boolean>(false);
  const [uploadedDocInfo, setUploadedDocInfo] = useState<{
    filename: string;
    status: string;
    rejection_reason?: string | null;
  } | null>(null);

  // Form states
  const [kycForm, setKycForm] = useState({
    full_name: '',
    date_of_birth: '1992-05-15',
    gender: 'MALE' as Gender,
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    pincode: '',
    id_type: 'PAN' as IDType,
    id_number: '',
  });

  const [bankForm, setBankForm] = useState({
    account_holder_name: '',
    account_number: '',
    ifsc: 'HDFC0001234',
    bank_name: SUPPORTED_BANKS[1].name, // HDFC Bank
  });

  const [ifscValidation, setIfscValidation] = useState<{ isValid: boolean; message: string }>(() =>
    validateBankIfsc(SUPPORTED_BANKS[1].name, 'HDFC0001234')
  );

  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Load current verification state from backend
  const loadState = async () => {
    try {
      setLoading(true);
      setError(null);
      const summ = await fetchVerificationSummary(applicationId);
      setSummary(summ);

      // Load specific details if verified
      if (summ.kyc === 'VERIFIED') {
        try {
          const k = await fetchKYC(applicationId);
          setKycData(k);
          if (k.document_filename || k.document_status) {
            setUploadedDocInfo({
              filename: k.document_filename || 'KYC_Document.pdf',
              status: k.document_status || 'KYC_DOCUMENT_UPLOADED',
              rejection_reason: k.document_rejection_reason,
            });
          }
        } catch {}
      }

      if (summ.bank_account === 'VERIFIED') {
        try {
          const b = await fetchBankAccount(applicationId);
          setBankData(b);
        } catch {}
      }

      // Always restore selfie data from backend
      if (summ.selfie_details) {
        setSelfieData(summ.selfie_details);
      } else if (summ.selfie !== 'NOT_STARTED') {
        try {
          const s = await fetchSelfie(applicationId);
          setSelfieData(s);
        } catch {}
      } else {
        setSelfieData(null);
      }

      if (summ.declaration === 'ACCEPTED') {
        try {
          const d = await fetchDeclaration(applicationId);
          setDeclarationData(d);
          setDeclarationAccepted(true);
        } catch {}
      }

      // Automatically determine first incomplete or actionable step
      const isSelfieSubmittedOrApproved =
        summ.selfie === 'PHOTO_PENDING_REVIEW' ||
        summ.selfie === 'PHOTO_APPROVED' ||
        summ.selfie === 'VERIFIED';
      const isSelfieRetakeRequired = summ.selfie === 'PHOTO_RETAKE_REQUIRED';

      if (initialStep) {
        setActiveStep(initialStep);
      } else if (initialMode === 'retake' || isSelfieRetakeRequired) {
        setActiveStep(3);
      } else if (summ.kyc !== 'VERIFIED') {
        setActiveStep(1);
      } else if (summ.bank_account !== 'VERIFIED') {
        setActiveStep(2);
      } else if (!isSelfieSubmittedOrApproved) {
        setActiveStep(3);
      } else if (summ.declaration !== 'ACCEPTED') {
        setActiveStep(4);
      } else {
        setActiveStep(5);
        if (onVerificationComplete) onVerificationComplete();
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load verification status.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, [applicationId]);

  // Step 1: Handle KYC Submission
  const handleKYCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedDocInfo) {
      setError('Please upload your identity document before continuing.');
      return;
    }
    if (uploadedDocInfo.status === 'KYC_REJECTED') {
      setError('Your previous KYC document was rejected. Please upload a replacement document before continuing.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitKYC(applicationId, kycForm);
      setKycData(res);
      setSuccess('Identity details and document recorded successfully.');
      await loadState();
      setActiveStep(2);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to submit identity details.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 1b: Handle KYC Document PDF Upload
  const handleKYCDocumentUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Invalid file format. Please upload your identity document as a PDF file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5 MB maximum limit.');
      return;
    }

    setUploadingKycDoc(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await uploadKYCDocument(applicationId, file);
      setUploadedDocInfo({
        filename: res.filename,
        status: res.status,
      });
      setSuccess(`✓ ${res.message} (${res.filename})`);
      await loadState();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to upload KYC document.'));
    } finally {
      setUploadingKycDoc(false);
    }
  };

  // Step 2: Handle Bank Account Submission
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const val = validateBankIfsc(bankForm.bank_name, bankForm.ifsc);
    setIfscValidation(val);
    if (!val.isValid) {
      setError(val.message);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitBankAccount(applicationId, bankForm);
      setBankData(res);
      setSuccess('Disbursement bank account verified.');
      await loadState();
      setActiveStep(3);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to verify bank account.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4: Handle Declaration Acceptance
  const handleDeclarationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedDocInfo) {
      setError('Please upload your identity document before continuing.');
      setActiveStep(1);
      return;
    }
    if (!declarationAccepted) {
      setError('Please acknowledge the terms to complete verification.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitDeclaration(applicationId, {
        accepted: true,
        declaration_version: 'v1.0',
      });
      setDeclarationData(res);
      setSuccess('Verification completed. Your file is ready for underwriting review.');
      await loadState();
      setActiveStep(5);
      if (onVerificationComplete) onVerificationComplete();
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to confirm declaration.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <Card padding="lg" className="text-center py-12 bg-white">
        <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-[#686D76]">Loading verification checkpoint…</p>
      </Card>
    );
  }

  const steps = [
    { num: 1, title: 'Identity (KYC)', done: summary?.kyc === 'VERIFIED' },
    { num: 2, title: 'Bank Account', done: summary?.bank_account === 'VERIFIED' },
    {
      num: 3,
      title: 'Live Photo',
      done:
        summary?.selfie === 'PHOTO_APPROVED' ||
        summary?.selfie === 'VERIFIED' ||
        summary?.selfie === 'PHOTO_PENDING_REVIEW',
    },
    { num: 4, title: 'Declaration', done: summary?.declaration === 'ACCEPTED' },
  ];

  return (
    <Card variant="elevated" padding="lg" className="space-y-6 bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-[#E5E2DC] pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#B5652D] font-mono">
            Identity & Account Verification
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial mt-1">
            Customer Verification
          </h2>
          <p className="text-sm text-[#686D76] mt-0.5">
            Four quick steps to verify your identity and link your destination bank account for direct disbursement.
          </p>
        </div>

        <span
          className={`px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border self-start sm:self-auto ${
            summary?.status === 'COMPLETED'
              ? 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A]'
              : 'bg-[#FDF6EC] border-[#F3E1C5] text-[#A8752B]'
          }`}
        >
          {summary?.status === 'COMPLETED' ? '✓ Verification Complete' : 'In Progress'}
        </span>
      </div>

      {/* Step Waypoint Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-[#E5E2DC] pb-4">
        {steps.map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => setActiveStep(s.num)}
            className={`p-3 sm:p-4 rounded-xl text-left transition-all border cursor-pointer ${
              activeStep === s.num
                ? 'bg-[#F9F3EE] border-[#B5652D] shadow-xs'
                : s.done
                ? 'bg-white border-[#E5E2DC] hover:border-[#D4D0C7]'
                : 'bg-[#F7F5F1] border-transparent text-[#8A8D93]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#686D76]">Step {s.num}</span>
              {s.done ? (
                <span className="text-sm font-bold text-[#1E5C4A]">✓</span>
              ) : (
                <span className="text-sm font-bold text-[#8A8D93]">○</span>
              )}
            </div>
            <span className={`text-sm font-bold block mt-1 ${activeStep === s.num ? 'text-[#14161A]' : s.done ? 'text-[#14161A]' : 'text-[#8A8D93]'}`}>
              {s.title}
            </span>
          </button>
        ))}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] text-sm flex items-center gap-2 font-medium">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] text-sm flex items-center gap-2 font-medium">
          <span>✓</span>
          <span>{success}</span>
        </div>
      )}

      {/* Step 1: KYC */}
      {activeStep === 1 && (
        <div className="space-y-5">
          <div className="p-4 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl">
            <span className="text-sm font-bold text-[#14161A] block">Why we need your identity details</span>
            <p className="text-sm text-[#686D76] mt-0.5">
              Mandatory KYC verification ensures digital lending compliance, prevents fraud, and confirms loan proceeds reach the verified borrower.
            </p>
          </div>

          {kycData ? (
            <div className="p-5 bg-white border border-[#C5E0D5] rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold text-[#1E5C4A] flex items-center gap-1.5">
                  <span>✓</span> Identity Details Verified ({kycData.id_type})
                </span>
                <span className="font-mono text-sm text-[#686D76]">{kycData.id_number_masked}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-[#686D76] pt-2 border-t border-[#E5E2DC]">
                <div>Name: <strong className="text-[#14161A]">{kycData.full_name}</strong></div>
                <div>DOB: <strong className="text-[#14161A]">{kycData.date_of_birth}</strong></div>
                <div className="col-span-2">Address: <strong className="text-[#14161A]">{kycData.address_line_1}, {kycData.city}, {kycData.state} - {kycData.pincode}</strong></div>
              </div>

              {/* KYC Document Status inside verified view */}
              <div className="pt-3 border-t border-[#E5E2DC] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#14161A]">
                      Supporting Identity Document (PDF)
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#FBEFEC] text-[#8C3A32] border border-[#F0D0CB]">
                      REQUIRED
                    </span>
                  </div>
                  <span className="text-xs text-[#8A8D93]">Max 5 MB • PDF format</span>
                </div>

                {uploadedDocInfo?.status === 'KYC_REJECTED' && (
                  <div className="p-3 bg-[#FBEFEC] border border-[#F0D0CB] rounded-xl text-xs text-[#8C3A32] space-y-1">
                    <span className="font-bold">⚠️ KYC document replacement required</span>
                    <p>{uploadedDocInfo.rejection_reason || 'Please upload a clearer copy.'}</p>
                  </div>
                )}

                {uploadedDocInfo && uploadedDocInfo.status !== 'KYC_REJECTED' ? (
                  <div className="p-3 bg-[#FAF8F5] border border-[#C5E0D5] rounded-xl text-xs flex items-center justify-between">
                    <span className="text-[#1E5C4A] font-semibold flex items-center gap-1.5">
                      <span>📄</span>
                      <span>{uploadedDocInfo.filename}</span>
                      <span className="text-[11px] text-[#686D76] font-normal">
                        ({uploadedDocInfo.status.replace(/_/g, ' ')})
                      </span>
                    </span>
                    <label className="text-xs text-[#B5652D] hover:underline cursor-pointer font-bold">
                      {uploadingKycDoc ? 'Uploading...' : 'Replace PDF'}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={uploadingKycDoc}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleKYCDocumentUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center py-4 px-4 bg-[#FAF8F5] border-2 border-dashed border-[#B5652D]/40 hover:border-[#B5652D] rounded-xl text-center cursor-pointer transition-all">
                      <span className="text-sm font-semibold text-[#14161A]">
                        {uploadingKycDoc ? '⏳ Uploading document...' : '📄 Click to Upload Required PDF Document'}
                      </span>
                      <span className="text-xs text-[#8C3A32] font-medium mt-0.5">
                        Please upload your identity document before continuing.
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={uploadingKycDoc}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleKYCDocumentUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  disabled={!uploadedDocInfo || uploadedDocInfo.status === 'KYC_REJECTED'}
                  onClick={() => {
                    if (!uploadedDocInfo || uploadedDocInfo.status === 'KYC_REJECTED') {
                      setError('Please upload your identity document before continuing.');
                      return;
                    }
                    setActiveStep(2);
                  }}
                >
                  Continue to Bank Verification →
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleKYCSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Legal Full Name"
                  required
                  value={kycForm.full_name}
                  onChange={(e) => setKycForm({ ...kycForm, full_name: e.target.value })}
                  placeholder="As per Government ID"
                />

                <Input
                  label="Date of Birth"
                  type="date"
                  required
                  value={kycForm.date_of_birth}
                  onChange={(e) => setKycForm({ ...kycForm, date_of_birth: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="ID Document Type"
                  options={[
                    { value: 'PAN', label: 'PAN Card' },
                    { value: 'AADHAAR', label: 'Aadhaar Card' },
                    { value: 'PASSPORT', label: 'Passport' },
                    { value: 'DRIVING_LICENSE', label: 'Driving License' },
                    { value: 'VOTER_ID', label: 'Voter ID' },
                  ]}
                  value={kycForm.id_type}
                  onChange={(e) => setKycForm({ ...kycForm, id_type: e.target.value as IDType })}
                />

                <Input
                  label="Document Number"
                  required
                  value={kycForm.id_number}
                  onChange={(e) => setKycForm({ ...kycForm, id_number: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  className="font-mono uppercase"
                />
              </div>

              <Input
                label="Address Line 1"
                required
                value={kycForm.address_line_1}
                onChange={(e) => setKycForm({ ...kycForm, address_line_1: e.target.value })}
                placeholder="Flat / House No., Building Name, Street"
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  required
                  value={kycForm.city}
                  onChange={(e) => setKycForm({ ...kycForm, city: e.target.value })}
                  placeholder="City"
                />
                <Input
                  label="State"
                  required
                  value={kycForm.state}
                  onChange={(e) => setKycForm({ ...kycForm, state: e.target.value })}
                  placeholder="State"
                />
                <Input
                  label="PIN Code"
                  required
                  maxLength={6}
                  value={kycForm.pincode}
                  onChange={(e) => setKycForm({ ...kycForm, pincode: e.target.value })}
                  placeholder="500081"
                  className="font-mono"
                />
              </div>

              {/* KYC Document Upload */}
              <div className="p-4 bg-[#FAF8F5] border border-[#E5E2DC] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#14161A]">
                      Supporting Identity Document (PDF)
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-[#FBEFEC] text-[#8C3A32] border border-[#F0D0CB]">
                      REQUIRED
                    </span>
                  </div>
                  <span className="text-xs text-[#8A8D93]">Max 5 MB • PDF format</span>
                </div>

                {uploadedDocInfo?.status === 'KYC_REJECTED' && (
                  <div className="p-3 bg-[#FBEFEC] border border-[#F0D0CB] rounded-xl text-xs text-[#8C3A32] space-y-1">
                    <span className="font-bold">⚠️ KYC document needs attention</span>
                    <p>{uploadedDocInfo.rejection_reason || 'Please upload a clearer copy.'}</p>
                  </div>
                )}

                {uploadedDocInfo ? (
                  <div className="p-3 bg-white border border-[#C5E0D5] rounded-xl text-xs flex items-center justify-between">
                    <span className="text-[#1E5C4A] font-semibold flex items-center gap-1.5">
                      <span>📄</span>
                      <span>{uploadedDocInfo.filename}</span>
                      <span className="text-[11px] text-[#686D76] font-normal">
                        ({uploadedDocInfo.status.replace(/_/g, ' ')})
                      </span>
                    </span>
                    <label className="text-xs text-[#B5652D] hover:underline cursor-pointer font-bold">
                      {uploadingKycDoc ? 'Uploading...' : 'Replace PDF'}
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={uploadingKycDoc}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleKYCDocumentUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div>
                    <label className="flex flex-col items-center justify-center py-4 px-4 bg-white border-2 border-dashed border-[#D4D0C7] hover:border-[#B5652D] rounded-xl text-center cursor-pointer transition-all">
                      <span className="text-sm font-semibold text-[#14161A]">
                        {uploadingKycDoc ? '⏳ Uploading document...' : '📄 Click to Choose PDF Document (Required)'}
                      </span>
                      <span className="text-xs text-[#8A8D93] mt-0.5">
                        Aadhaar Card, PAN Card, Passport, or Driving License
                      </span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        disabled={uploadingKycDoc}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleKYCDocumentUpload(e.target.files[0]);
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" isLoading={submitting}>
                  Verify Identity Details →
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Step 2: Bank Account */}
      {activeStep === 2 && (
        <div className="space-y-5">
          <div className="p-4 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl">
            <span className="text-sm font-bold text-[#14161A] block">Why we need your bank details</span>
            <p className="text-sm text-[#686D76] mt-0.5">
              Your approved loan amount will be transferred directly into this account upon underwriter authorization.
            </p>
          </div>

          {bankData ? (
            <div className="p-5 bg-white border border-[#C5E0D5] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold text-[#1E5C4A] flex items-center gap-1.5">
                  <span>✓</span> Bank Account Linked
                </span>
                <span className="font-mono text-sm text-[#686D76]">{bankData.account_number_masked}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-[#686D76] pt-2 border-t border-[#E5E2DC]">
                <div>Bank: <strong className="text-[#14161A]">{bankData.bank_name}</strong></div>
                <div>IFSC: <strong className="text-[#14161A] font-mono">{bankData.ifsc}</strong></div>
                <div className="col-span-2">Holder: <strong className="text-[#14161A]">{bankData.account_holder_name}</strong></div>
              </div>
              <div className="pt-2 flex justify-end">
                <Button variant="primary" size="md" onClick={() => setActiveStep(3)}>
                  Continue to Photo Verification →
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBankSubmit} className="space-y-4">
              <Input
                label="Account Holder Full Name"
                required
                value={bankForm.account_holder_name}
                onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                placeholder="As per bank passbook / statement"
              />

              <Select
                label="Bank Name"
                options={SUPPORTED_BANKS.map((b) => ({
                  value: b.name,
                  label: `${b.name} (${b.ifscPrefix})`,
                }))}
                value={bankForm.bank_name}
                onChange={(e) => {
                  const newBank = e.target.value;
                  const matched = SUPPORTED_BANKS.find((b) => b.name === newBank);
                  const suggestedIfsc = matched ? matched.exampleIfsc : bankForm.ifsc;
                  setBankForm({ ...bankForm, bank_name: newBank, ifsc: suggestedIfsc });
                  setIfscValidation(validateBankIfsc(newBank, suggestedIfsc));
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Bank Account Number"
                  required
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  placeholder="Enter account number"
                  className="font-mono"
                />

                <Input
                  label="IFSC Code"
                  required
                  maxLength={11}
                  value={bankForm.ifsc}
                  onChange={(e) => {
                    const newIfsc = e.target.value.toUpperCase();
                    setBankForm({ ...bankForm, ifsc: newIfsc });
                    setIfscValidation(validateBankIfsc(bankForm.bank_name, newIfsc));
                  }}
                  placeholder="e.g. HDFC0001234"
                  className="font-mono uppercase"
                  error={!ifscValidation.isValid ? ifscValidation.message : undefined}
                  hint={ifscValidation.isValid ? ifscValidation.message : undefined}
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" isLoading={submitting}>
                  Verify Bank Account →
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Step 3: Selfie Camera Capture */}
      {activeStep === 3 && (
        <SelfieCameraCapture
          applicationId={applicationId}
          existingSelfie={selfieData}
          initialMode={initialMode}
          onSelfieVerified={async (res) => {
            setSelfieData(res);
            setSuccess('Photo submitted successfully. Awaiting underwriting review.');
            await loadState();
            setActiveStep(4);
          }}
          onContinue={() => setActiveStep(4)}
        />
      )}

      {/* Step 4: Declaration */}
      {activeStep === 4 && (
        <div className="space-y-5">
          <div className="p-4 bg-[#F7F5F1] border border-[#E5E2DC] rounded-xl">
            <span className="text-sm font-bold text-[#14161A] block">Borrower Consent & Declaration</span>
            <p className="text-sm text-[#686D76] mt-0.5">
              Review and agree to the digital lending terms and credit underwriting assessment terms.
            </p>
          </div>

          {declarationData ? (
            <div className="p-5 bg-white border border-[#C5E0D5] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-bold text-[#1E5C4A] flex items-center gap-1.5">
                  <span>✓</span> Legal Declaration Accepted ({declarationData.declaration_version})
                </span>
                <span className="text-xs text-[#686D76]">{new Date(declarationData.accepted_at).toLocaleString('en-IN')}</span>
              </div>
              <p className="text-sm text-[#686D76]">
                All verification steps have been completed. Your application is now in the underwriting queue.
              </p>
            </div>
          ) : (
            <form onSubmit={handleDeclarationSubmit} className="space-y-4">
              <div className="p-4 bg-white border border-[#E5E2DC] rounded-xl text-sm text-[#686D76] space-y-2 max-h-48 overflow-y-auto leading-relaxed">
                <p>1. I confirm that all information, documents, and income details provided in this application are authentic and accurate.</p>
                <p>2. I authorize EZFINANZ and its lending partners to verify my credit history, KYC documentation, and employment records.</p>
                <p>3. I agree to repay the agreed loan amount and monthly EMIs according to the selected schedule upon disbursement.</p>
              </div>

              <label className="flex items-start gap-3 p-3.5 bg-[#F9F3EE] border border-[#ECCBB3] rounded-xl cursor-pointer text-sm text-[#14161A]">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-1 rounded border-[#D4D0C7] text-[#B5652D] focus:ring-[#B5652D]"
                />
                <span className="font-medium">
                  I have read and unconditionally accept the loan declaration terms and privacy policies.
                </span>
              </label>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" isLoading={submitting}>
                  Complete Verification & Submit for Review →
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Step 5: Completed state */}
      {activeStep === 5 && (
        <div className="p-6 sm:p-8 bg-[#E8F2EE] border border-[#C5E0D5] rounded-2xl text-center space-y-3">
          <span className="text-3xl block text-[#1E5C4A]">✓</span>
          <h3 className="text-xl font-bold text-[#1E5C4A] font-editorial">
            Customer Verification Complete
          </h3>
          <p className="text-sm text-[#14161A] max-w-md mx-auto leading-relaxed">
            All four verification milestones (Identity, Bank Account, Photo, and Legal Declaration) are recorded in the ledger. Your file has been transitioned to our Credit Underwriting team.
          </p>
        </div>
      )}
    </Card>
  );
};
