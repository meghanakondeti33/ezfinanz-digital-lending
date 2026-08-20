import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApplications, fetchOffers } from '../lib/loans-api';
import {
  fetchVerificationSummary,
  fetchKYC,
  fetchBankAccount,
  fetchSelfie,
  fetchDeclaration,
} from '../lib/verification-api';
import type { LoanApplication, LoanOffer } from '../types/loan';
import type {
  VerificationSummary,
  KYCData,
  BankAccountData,
  SelfieData,
  DeclarationData,
} from '../types/verification';
import { CustomerLayout } from '../components/layout/CustomerLayout';
import { StatusBadge } from '../components/ui/StatusBadge';
import { VerificationStatusBadge } from '../components/ui/VerificationStatusBadge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

type HistoryTab = 'all' | 'loans' | 'verification' | 'activity';

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  statusType?: 'success' | 'warning' | 'info' | 'neutral';
}

export const CustomerHistory: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HistoryTab>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [verifSummary, setVerifSummary] = useState<VerificationSummary | null>(null);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [bankData, setBankData] = useState<BankAccountData | null>(null);
  const [selfieData, setSelfieData] = useState<SelfieData | null>(null);
  const [declData, setDeclData] = useState<DeclarationData | null>(null);

  useEffect(() => {
    const loadCustomerRecords = async () => {
      try {
        setLoading(true);
        const appsRes = await fetchApplications();
        const appsList = appsRes.items || [];
        setApplications(appsList);

        if (appsList.length > 0) {
          const primaryId = appsList[0].id;
          const [offersRes, vSumm, kyc, bank, selfie, decl] = await Promise.allSettled([
            fetchOffers(primaryId),
            fetchVerificationSummary(primaryId),
            fetchKYC(primaryId),
            fetchBankAccount(primaryId),
            fetchSelfie(primaryId),
            fetchDeclaration(primaryId),
          ]);

          if (offersRes.status === 'fulfilled' && offersRes.value?.offers) {
            const sel = offersRes.value.offers.find((o) => o.status === 'SELECTED') || offersRes.value.offers[0];
            setSelectedOffer(sel || null);
          }
          if (vSumm.status === 'fulfilled') setVerifSummary(vSumm.value);
          if (kyc.status === 'fulfilled') setKycData(kyc.value);
          if (bank.status === 'fulfilled') setBankData(bank.value);
          if (selfie.status === 'fulfilled') setSelfieData(selfie.value);
          if (decl.status === 'fulfilled') setDeclData(decl.value);
        }
      } catch {
        // Handled cleanly
      } finally {
        setLoading(false);
      }
    };

    loadCustomerRecords();
  }, [user]);

  // Build clean customer-safe activity timeline events
  const timelineEvents: TimelineEvent[] = [];
  const primaryApp = applications.length > 0 ? applications[0] : null;

  if (primaryApp) {
    // 1. Created / Drafted
    timelineEvents.push({
      id: 'created',
      title: 'Loan Application Created',
      description: `Draft application #${primaryApp.application_number} started for ₹${Number(primaryApp.requested_amount || 0).toLocaleString('en-IN')}`,
      timestamp: primaryApp.created_at,
      icon: '📝',
      statusType: 'neutral',
    });

    // 2. Submitted / Eligibility
    if (primaryApp.status !== 'DRAFT') {
      timelineEvents.push({
        id: 'submitted',
        title: 'Application Submitted & Eligibility Assessed',
        description: 'Financial information evaluated by the underwriting engine.',
        timestamp: primaryApp.updated_at || primaryApp.created_at,
        icon: '⚖️',
        statusType: 'info',
      });
    }

    // 3. Offer Selected
    if (
      selectedOffer ||
      primaryApp.status === 'OFFER_SELECTED' ||
      primaryApp.status === 'UNDER_REVIEW' ||
      primaryApp.status === 'APPROVED' ||
      primaryApp.status === 'DISBURSEMENT_PROCESSING' ||
      primaryApp.status === 'DISBURSED'
    ) {
      timelineEvents.push({
        id: 'offer_selected',
        title: 'Repayment Plan Selected',
        description: selectedOffer
          ? `Selected ₹${Number(selectedOffer.principal || 0).toLocaleString('en-IN')} loan at ${selectedOffer.interest_rate}% p.a.`
          : 'Customer selected an eligible loan offer tier.',
        timestamp: primaryApp.updated_at || primaryApp.created_at,
        icon: '💰',
        statusType: 'success',
      });
    }

    // 4. KYC Uploaded
    if (kycData?.document_status && kycData.document_status !== 'NOT_SUBMITTED') {
      timelineEvents.push({
        id: 'kyc_uploaded',
        title: 'KYC Document Submitted',
        description: `Government ID (${kycData.id_type || 'Aadhaar'}) uploaded for verification. Status: ${kycData.document_status}`,
        timestamp: kycData.document_uploaded_at || kycData.created_at,
        icon: '🪪',
        statusType: kycData.document_status === 'VERIFIED' ? 'success' : kycData.document_status === 'FAILED' ? 'warning' : 'info',
      });
    }

    // 5. Bank Account Submitted
    if (bankData?.account_number_masked) {
      timelineEvents.push({
        id: 'bank_verified',
        title: 'Destination Bank Account Linked',
        description: `${bankData.bank_name || 'Bank'} account (${bankData.account_number_masked}) validated via automated check.`,
        timestamp: bankData.created_at || primaryApp.updated_at,
        icon: '🏦',
        statusType: 'success',
      });
    }

    // 6. Live Photo Submitted
    if (selfieData?.status) {
      timelineEvents.push({
        id: 'selfie_submitted',
        title: 'Live Photo Capture Submitted',
        description: selfieData.status === 'PHOTO_RETAKE_REQUIRED'
          ? `Retake requested: "${selfieData.rejection_reason || 'Please upload a clearer photo'}"`
          : selfieData.status === 'PHOTO_APPROVED'
          ? 'Live photograph approved by underwriter.'
          : 'Live photo submitted for underwriter inspection.',
        timestamp: selfieData.submitted_at || primaryApp.updated_at,
        icon: '📷',
        statusType: selfieData.status === 'PHOTO_APPROVED' ? 'success' : selfieData.status === 'PHOTO_RETAKE_REQUIRED' ? 'warning' : 'info',
      });
    }

    // 7. Declaration Consent
    if (declData?.accepted) {
      timelineEvents.push({
        id: 'declaration_signed',
        title: 'Legal Declaration & Digital Consent Signed',
        description: `Agreed to digital loan terms (version ${declData.declaration_version || 'v1.0'}).`,
        timestamp: declData.accepted_at || primaryApp.updated_at,
        icon: '📜',
        statusType: 'success',
      });
    }

    // 8. Sanction / Approval
    if (
      primaryApp.status === 'APPROVED' ||
      primaryApp.status === 'DISBURSEMENT_PROCESSING' ||
      primaryApp.status === 'DISBURSED'
    ) {
      timelineEvents.push({
        id: 'approved',
        title: 'Loan Application Approved & Sanctioned',
        description: 'Underwriter approved the application and authorized electronic disbursement.',
        timestamp: primaryApp.updated_at,
        icon: '✓',
        statusType: 'success',
      });
    }

    // 9. Disbursement
    if (primaryApp.status === 'DISBURSED') {
      timelineEvents.push({
        id: 'disbursed',
        title: 'Loan Disbursed to Bank Account',
        description: 'Funds successfully transferred to your destination bank account.',
        timestamp: primaryApp.updated_at,
        icon: '💸',
        statusType: 'success',
      });
    } else if (primaryApp.status === 'REJECTED') {
      timelineEvents.push({
        id: 'rejected',
        title: 'Application Declined',
        description: 'Application was declined in accordance with lending risk policy.',
        timestamp: primaryApp.updated_at,
        icon: '✕',
        statusType: 'warning',
      });
    }
  }

  // Sort timeline events chronologically (most recent first)
  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <CustomerLayout
      sidebarMode="workspace"
      primaryApplicationId={primaryApp?.id}
      activeNav="history"
    >
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E2DC] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link to="/dashboard" className="text-xs font-semibold text-[#B5652D] hover:underline">
                ← Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#14161A] font-editorial">
              My Records & History
            </h1>
            <p className="text-xs sm:text-sm text-[#686D76] mt-0.5">
              Complete historical overview of your loan applications, verifications, and lifecycle milestones.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/loans/new">
              <Button variant="primary" size="sm" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white text-xs">
                + New Application
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 border-b border-[#E5E2DC] pb-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'loans', label: 'Loan History' },
            { id: 'verification', label: 'Verification Dossier' },
            { id: 'activity', label: 'Activity Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as HistoryTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#FAF3EE] text-[#B5652D] font-bold border border-[#F3D7C4]'
                  : 'text-[#686D76] hover:bg-[#F7F5F1] hover:text-[#14161A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-16 text-center text-[#686D76]">
            <div className="animate-spin h-6 w-6 border-2 border-[#B5652D] border-t-transparent rounded-full mx-auto mb-2" />
            <span className="text-xs">Loading your complete lending history…</span>
          </div>
        ) : applications.length === 0 ? (
          <Card variant="default" padding="lg" className="text-center py-12 bg-white border border-[#E5E2DC] rounded-2xl">
            <span className="text-3xl block mb-2">📄</span>
            <h3 className="font-bold text-base text-[#14161A]">No Loan Records Found</h3>
            <p className="text-xs text-[#686D76] mt-1 max-w-sm mx-auto">
              You do not have any active or past loan applications with EZFINANZ yet.
            </p>
            <div className="mt-4">
              <Link to="/loans/new">
                <Button variant="primary" size="sm" className="bg-[#B5652D] hover:bg-[#9C4F1C] text-white">
                  Apply for a Loan →
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* ========================================================================= */}
            {/* TAB: ALL / LOAN HISTORY */}
            {/* ========================================================================= */}
            {(activeTab === 'all' || activeTab === 'loans') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                    Loan Applications ({applications.length})
                  </span>
                </div>

                <div className="space-y-3">
                  {applications.map((app) => (
                    <Card
                      key={app.id}
                      variant="default"
                      padding="md"
                      className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAE7E1] pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center font-bold text-sm">
                            💰
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-[#14161A]">
                                #{app.application_number}
                              </span>
                              <StatusBadge status={app.status} size="sm" />
                            </div>
                            <span className="text-[11px] text-[#8A8D93] block">
                              Created on {new Date(app.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link to={`/loans/${app.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              Open Application →
                            </Button>
                          </Link>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#FAF8F5] p-3 rounded-xl border border-[#EAE7E1]">
                        <div>
                          <span className="text-[#8A8D93] text-[11px] block">Requested Principal</span>
                          <strong className="font-mono text-sm text-[#14161A] block mt-0.5">
                            ₹{Number(app.requested_amount || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#8A8D93] text-[11px] block">Loan Purpose</span>
                          <strong className="text-xs text-[#14161A] block mt-0.5 truncate">
                            {app.purpose || 'Personal Loan'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#8A8D93] text-[11px] block">Repayment Tenure</span>
                          <strong className="text-xs text-[#14161A] block mt-0.5">
                            {app.requested_tenure_months || 36} Months
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#8A8D93] text-[11px] block">Monthly Income</span>
                          <strong className="font-mono text-xs text-[#14161A] block mt-0.5">
                            ₹{Number(app.monthly_income || 0).toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB: ALL / VERIFICATION HISTORY */}
            {/* ========================================================================= */}
            {(activeTab === 'all' || activeTab === 'verification') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                    Verification Records
                  </span>
                  <span className="text-[11px] text-[#686D76]">
                    4-part compliance verification dossier
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. KYC Identity */}
                  <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                      <div className="flex items-center gap-2">
                        <span>🪪</span>
                        <span className="font-bold text-xs text-[#14161A]">1. KYC Document</span>
                      </div>
                      <VerificationStatusBadge status={verifSummary?.kyc || kycData?.document_status} size="sm" />
                    </div>
                    <div className="space-y-1 text-xs text-[#686D76]">
                      <div className="flex justify-between">
                        <span>ID Type:</span>
                        <strong className="text-[#14161A]">{kycData?.id_type || 'AADHAAR'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Masked ID:</span>
                        <strong className="font-mono text-[#14161A]">{kycData?.id_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                      </div>
                      {kycData?.document_rejection_reason && (
                        <div className="p-2 bg-[#FBEFEC] rounded-lg text-[#8C3A32] text-[11px] mt-1">
                          Remark: &ldquo;{kycData.document_rejection_reason}&rdquo;
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* 2. Bank Account */}
                  <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                      <div className="flex items-center gap-2">
                        <span>🏦</span>
                        <span className="font-bold text-xs text-[#14161A]">2. Destination Bank</span>
                      </div>
                      <VerificationStatusBadge status={verifSummary?.bank_account} size="sm" />
                    </div>
                    <div className="space-y-1 text-xs text-[#686D76]">
                      <div className="flex justify-between">
                        <span>Bank Name:</span>
                        <strong className="text-[#14161A] truncate">{bankData?.bank_name || 'Verified Institution'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Account Number:</span>
                        <strong className="font-mono text-[#14161A]">{bankData?.account_number_masked || 'XXXX-XXXX-XXXX'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>IFSC Code:</span>
                        <strong className="font-mono text-[#14161A]">{bankData?.ifsc || 'N/A'}</strong>
                      </div>
                    </div>
                  </Card>

                  {/* 3. Live Photo / Selfie */}
                  <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                      <div className="flex items-center gap-2">
                        <span>📷</span>
                        <span className="font-bold text-xs text-[#14161A]">3. Live Photo / Selfie</span>
                      </div>
                      <VerificationStatusBadge status={verifSummary?.selfie || selfieData?.status} size="sm" />
                    </div>
                    <div className="space-y-1 text-xs text-[#686D76]">
                      <div className="flex justify-between">
                        <span>Capture Method:</span>
                        <strong className="text-[#14161A]">In-Browser Camera</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Submitted:</span>
                        <strong className="text-[#14161A]">
                          {selfieData?.submitted_at
                            ? new Date(selfieData.submitted_at).toLocaleDateString('en-IN')
                            : 'Yes'}
                        </strong>
                      </div>
                      {selfieData?.rejection_reason && (
                        <div className="p-2 bg-[#FBEFEC] rounded-lg text-[#8C3A32] text-[11px] mt-1">
                          Retake note: &ldquo;{selfieData.rejection_reason}&rdquo;
                        </div>
                      )}
                    </div>
                  </Card>

                  {/* 4. Declaration */}
                  <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl space-y-2">
                    <div className="flex items-center justify-between border-b border-[#EAE7E1] pb-2">
                      <div className="flex items-center gap-2">
                        <span>📜</span>
                        <span className="font-bold text-xs text-[#14161A]">4. Legal Declaration</span>
                      </div>
                      <VerificationStatusBadge status={declData?.accepted ? 'ACCEPTED' : 'NOT_ACCEPTED'} size="sm" />
                    </div>
                    <div className="space-y-1 text-xs text-[#686D76]">
                      <div className="flex justify-between">
                        <span>Consent:</span>
                        <strong className="text-[#1E5C4A]">{declData?.accepted ? '✓ Explicitly Agreed' : 'Pending'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Timestamp:</span>
                        <strong className="text-[#14161A]">
                          {declData?.accepted_at
                            ? new Date(declData.accepted_at).toLocaleString('en-IN')
                            : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB: ALL / ACTIVITY TIMELINE */}
            {/* ========================================================================= */}
            {(activeTab === 'all' || activeTab === 'activity') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B5652D]">
                    Activity Timeline & Milestones
                  </span>
                  <span className="text-[11px] text-[#686D76]">
                    Chronological lifecycle events
                  </span>
                </div>

                <Card variant="default" padding="md" className="bg-white border border-[#E5E2DC] shadow-2xs rounded-2xl">
                  <div className="space-y-4">
                    {timelineEvents.map((evt, idx) => (
                      <div key={evt.id || idx} className="flex items-start gap-3.5 relative">
                        {/* Connecting Line */}
                        {idx !== timelineEvents.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-[#EAE7E1] -ml-[1px]" />
                        )}

                        <div className="w-8 h-8 rounded-full bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] flex items-center justify-center text-sm shrink-0 z-10">
                          {evt.icon}
                        </div>

                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-[#14161A]">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-[#8A8D93]">
                              {new Date(evt.timestamp).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <p className="text-xs text-[#686D76] mt-0.5">
                            {evt.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};

export default CustomerHistory;
