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
  submitSelfie,
} from '../../lib/verification-api';

interface VerificationWizardProps {
  applicationId: string;
  onVerificationComplete?: () => void;
}

export const VerificationWizard: React.FC<VerificationWizardProps> = ({
  applicationId,
  onVerificationComplete,
}) => {
  const [summary, setSummary] = useState<VerificationSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Verification step entities
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [bankData, setBankData] = useState<BankAccountData | null>(null);
  const [selfieData, setSelfieData] = useState<SelfieData | null>(null);
  const [declarationData, setDeclarationData] = useState<DeclarationData | null>(null);

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
    bank_name: 'HDFC Bank',
  });

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
        } catch {}
      }

      if (summ.bank_account === 'VERIFIED') {
        try {
          const b = await fetchBankAccount(applicationId);
          setBankData(b);
        } catch {}
      }

      if (summ.selfie === 'VERIFIED') {
        try {
          const s = await fetchSelfie(applicationId);
          setSelfieData(s);
        } catch {}
      }

      if (summ.declaration === 'ACCEPTED') {
        try {
          const d = await fetchDeclaration(applicationId);
          setDeclarationData(d);
          setDeclarationAccepted(true);
        } catch {}
      }

      // Automatically determine first incomplete step
      if (summ.kyc !== 'VERIFIED') setActiveStep(1);
      else if (summ.bank_account !== 'VERIFIED') setActiveStep(2);
      else if (summ.selfie !== 'VERIFIED') setActiveStep(3);
      else if (summ.declaration !== 'ACCEPTED') setActiveStep(4);
      else {
        setActiveStep(5);
        if (onVerificationComplete) onVerificationComplete();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load verification pipeline state.');
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
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitKYC(applicationId, kycForm);
      setKycData(res);
      setSuccess('KYC documents verified successfully!');
      await loadState();
      setActiveStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to submit KYC.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Handle Bank Account Submission
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitBankAccount(applicationId, bankForm);
      setBankData(res);
      setSuccess('Disbursement bank account verified successfully!');
      await loadState();
      setActiveStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to verify bank account.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Handle Selfie Submission
  const handleSelfieSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await submitSelfie(applicationId, {
        storage_key: `selfies/${applicationId}_live_photo.jpg`,
      });
      setSelfieData(res);
      setSuccess('Live photo / selfie verification completed!');
      await loadState();
      setActiveStep(4);
    } catch (err: any) {
      setError(err.message || 'Selfie verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 4: Handle Declaration Acceptance
  const handleDeclarationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declarationAccepted) {
      setError('You must check the agreement box to accept terms.');
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
      setSuccess('🎉 Declaration accepted! Complete verification achieved.');
      await loadState();
      setActiveStep(5);
      if (onVerificationComplete) onVerificationComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to accept declaration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mx-auto mb-4"></div>
        <div className="h-4 w-64 bg-slate-800/60 rounded mx-auto"></div>
      </div>
    );
  }

  const steps = [
    { num: 1, title: 'Identity (KYC)', done: summary?.kyc === 'VERIFIED' },
    { num: 2, title: 'Bank Account', done: summary?.bank_account === 'VERIFIED' },
    { num: 3, title: 'Live Selfie', done: summary?.selfie === 'VERIFIED' },
    { num: 4, title: 'Declaration', done: summary?.declaration === 'ACCEPTED' },
    { num: 5, title: 'Completed', done: summary?.status === 'COMPLETED' },
  ];

  return (
    <div className="bg-slate-900/90 border border-blue-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Verification Pipeline
          </span>
          <h2 className="text-xl font-bold text-white mt-0.5">
            Customer Identity & Account Verification
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${
              summary?.status === 'COMPLETED'
                ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                : summary?.status === 'IN_PROGRESS'
                ? 'bg-blue-950/60 border-blue-700 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {summary?.status === 'COMPLETED'
              ? '✓ COMPLETED'
              : summary?.status === 'IN_PROGRESS'
              ? 'IN PROGRESS'
              : 'NOT STARTED'}
          </span>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pb-2">
        {steps.map((s) => {
          const isCurrent = activeStep === s.num;
          const isDone = s.done;

          return (
            <button
              key={s.num}
              type="button"
              onClick={() => (isDone || s.num <= (activeStep + 1) ? setActiveStep(s.num) : null)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isDone
                  ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                  : isCurrent
                  ? 'bg-blue-950/40 border-blue-600 text-blue-300 shadow-md ring-1 ring-blue-500'
                  : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Step {s.num}
                </span>
                <span className="text-xs">
                  {isDone ? '✓' : isCurrent ? '●' : '○'}
                </span>
              </div>
              <p className="text-xs font-semibold text-white mt-1 truncate">{s.title}</p>
            </button>
          );
        })}
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

      {/* STEP 1: KYC FORM */}
      {activeStep === 1 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🪪</span> Step 1: Know Your Customer (KYC)
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              Deterministic Mock Verification
            </span>
          </div>

          {summary?.kyc === 'VERIFIED' && kycData ? (
            <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span>✓</span> KYC Verified
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {kycData.id_number_masked}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Full Name:</span>
                  <span className="font-semibold text-white">{kycData.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">ID Type:</span>
                  <span className="font-semibold text-white">{kycData.id_type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">City & State:</span>
                  <span className="font-semibold text-white">{kycData.city}, {kycData.state}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">DOB:</span>
                  <span className="font-semibold text-white">{kycData.date_of_birth}</span>
                </div>
              </div>
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep(2)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
                >
                  Proceed to Bank Account Verification →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleKYCSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.full_name}
                    onChange={(e) => setKycForm({ ...kycForm, full_name: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={kycForm.date_of_birth}
                    onChange={(e) => setKycForm({ ...kycForm, date_of_birth: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender *</label>
                  <select
                    value={kycForm.gender}
                    onChange={(e) => setKycForm({ ...kycForm, gender: e.target.value as Gender })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.address_line_1}
                    onChange={(e) => setKycForm({ ...kycForm, address_line_1: e.target.value })}
                    placeholder="Flat / Building / Street"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    value={kycForm.address_line_2}
                    onChange={(e) => setKycForm({ ...kycForm, address_line_2: e.target.value })}
                    placeholder="Locality / Landmark"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.city}
                    onChange={(e) => setKycForm({ ...kycForm, city: e.target.value })}
                    placeholder="e.g. Hyderabad"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.state}
                    onChange={(e) => setKycForm({ ...kycForm, state: e.target.value })}
                    placeholder="e.g. Telangana"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.pincode}
                    onChange={(e) => setKycForm({ ...kycForm, pincode: e.target.value })}
                    placeholder="e.g. 500081"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Government ID Type *</label>
                  <select
                    value={kycForm.id_type}
                    onChange={(e) => setKycForm({ ...kycForm, id_type: e.target.value as IDType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="PAN">PAN Card</option>
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="VOTER_ID">Voter ID</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">ID Number / Reference *</label>
                  <input
                    type="text"
                    required
                    value={kycForm.id_number}
                    onChange={(e) => setKycForm({ ...kycForm, id_number: e.target.value })}
                    placeholder="e.g. ABCDE1234F"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Verifying KYC...' : 'Verify & Submit KYC →'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* STEP 2: BANK ACCOUNT FORM */}
      {activeStep === 2 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🏦</span> Step 2: Disbursement Bank Account
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              Mock Penny-Drop Verification
            </span>
          </div>

          {summary?.bank_account === 'VERIFIED' && bankData ? (
            <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Bank Account Verified
                </span>
                <span className="text-xs text-slate-400 font-mono">Account: {bankData.account_number_masked}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Holder Name:</span>
                  <span className="font-semibold text-white">{bankData.account_holder_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Bank Name:</span>
                  <span className="font-semibold text-white">{bankData.bank_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC Code:</span>
                  <span className="font-semibold text-white font-mono">{bankData.ifsc}</span>
                </div>
              </div>
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
                >
                  Proceed to Selfie Verification →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBankSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Holder Name *</label>
                  <input
                    type="text"
                    required
                    value={bankForm.account_holder_name}
                    onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                    placeholder="Must match KYC full name"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    placeholder="e.g. HDFC Bank"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Account Number *</label>
                  <input
                    type="password"
                    required
                    value={bankForm.account_number}
                    onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                    placeholder="Enter full bank account number"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">IFSC Code (11 characters) *</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. HDFC0001234"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Verifying Account...' : 'Verify Bank Account →'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* STEP 3: SELFIE VERIFICATION */}
      {activeStep === 3 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>📸</span> Step 3: Live Photo / Selfie Verification
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              Simulated Liveness Check
            </span>
          </div>

          {summary?.selfie === 'VERIFIED' && selfieData ? (
            <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Live Photo Verified
                </span>
                <span className="text-xs text-slate-400">Type: {selfieData.verification_type}</span>
              </div>
              <p className="text-xs text-slate-300">
                Live biometric presence check passed deterministically. Metadata stored in audit log.
              </p>
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep(4)}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all"
                >
                  Proceed to Final Declaration →
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-950 border border-blue-700 flex items-center justify-center mx-auto text-2xl">
                🤳
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-sm font-bold text-white">Live Liveness & Identity Verification</h4>
                <p className="text-xs text-slate-400 mt-1">
                  In production, this module captures a real-time biometric snapshot. For this assessment, click below to execute simulated verification.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSelfieSubmit}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? 'Verifying Live Photo...' : 'Capture & Verify Selfie →'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: DECLARATION */}
      {activeStep === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>✍️</span> Step 4: Borrower Legal Declaration
            </h3>
            <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
              Digital Terms v1.0
            </span>
          </div>

          {summary?.declaration === 'ACCEPTED' && declarationData ? (
            <div className="bg-emerald-950/20 border border-emerald-800/60 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <span>✓</span> Declaration Signed & Accepted
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Timestamp: {new Date(declarationData.accepted_at).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                You have confirmed all loan terms, financial commitments, and authorized EZFINANZ to process your application.
              </p>
              <div className="pt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveStep(5)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all"
                >
                  View Final Verification Summary →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleDeclarationSubmit} className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2 max-h-48 overflow-y-auto font-sans leading-relaxed">
                <p className="font-bold text-white">EZFINANZ DIGITAL LENDING DECLARATION (v1.0)</p>
                <p>
                  1. I declare that all information provided during this loan application (including personal identity, monthly income, existing debts, and banking details) is complete, true, and accurate to the best of my knowledge.
                </p>
                <p>
                  2. I understand that fraudulent declarations or misrepresented financial records may result in loan cancellation and legal proceedings under applicable laws.
                </p>
                <p>
                  3. I authorize EZFINANZ and its lending partners to verify my credit history, bank statements, and employment details for underwriting and credit risk evaluation.
                </p>
                <p>
                  4. I agree to the reducing-balance EMI schedule, processing fee deductions, and monthly repayment obligations selected in my loan offer package.
                </p>
              </div>

              <div className="flex items-start space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="declaration-agree"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="declaration-agree" className="text-xs text-slate-200 cursor-pointer">
                  <span className="font-semibold text-white">I agree and confirm</span> that I have read, understood, and accepted all terms and conditions of this loan declaration.
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting || !declarationAccepted}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                >
                  {submitting ? 'Recording Acceptance...' : 'Sign Declaration & Complete Verification →'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* STEP 5: COMPLETED STATE */}
      {activeStep === 5 && (
        <div className="bg-emerald-950/30 border border-emerald-700/80 rounded-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto text-2xl font-black">
            ✓
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Verification Pipeline Complete!</h3>
            <p className="text-xs text-emerald-300 mt-1 max-w-md mx-auto">
              All 4 verification stages (KYC, Bank Account, Live Selfie, and Legal Declaration) have been verified and permanently recorded.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left max-w-xl mx-auto pt-2">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">KYC</span>
              <span className="text-xs text-emerald-400 font-semibold">✓ Verified</span>
            </div>
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Bank</span>
              <span className="text-xs text-emerald-400 font-semibold">✓ Verified</span>
            </div>
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Selfie</span>
              <span className="text-xs text-emerald-400 font-semibold">✓ Verified</span>
            </div>
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Declaration</span>
              <span className="text-xs text-emerald-400 font-semibold">✓ Accepted</span>
            </div>
          </div>

          <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl max-w-xl mx-auto text-xs text-slate-300">
            <span className="font-bold text-white block mb-1">Next Step: Underwriting & Administrative Review</span>
            Your loan application is now in <span className="text-blue-400 font-mono font-bold">UNDER_REVIEW</span> status. Credit underwriters will review your submitted application files before loan approval.
          </div>
        </div>
      )}
    </div>
  );
};
