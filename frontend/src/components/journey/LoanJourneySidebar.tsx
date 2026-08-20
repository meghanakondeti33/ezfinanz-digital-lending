import React from 'react';
import type { VerificationSummary } from '../../types/verification';

export type LoanStageId =
  | 'application'
  | 'eligibility'
  | 'offers'
  | 'verification'
  | 'underwriting'
  | 'approval'
  | 'disbursement';

export interface StageDefinition {
  id: LoanStageId;
  number: number;
  title: string;
  shortDesc: string;
}

export const LOAN_STAGES: StageDefinition[] = [
  { id: 'application', number: 1, title: 'Application', shortDesc: 'Amount & income profile' },
  { id: 'eligibility', number: 2, title: 'Eligibility', shortDesc: 'Instant financial assessment' },
  { id: 'offers', number: 3, title: 'Offer Selection', shortDesc: 'Curated repayment plans' },
  { id: 'verification', number: 4, title: 'Verification', shortDesc: 'KYC, bank & live photo' },
  { id: 'underwriting', number: 5, title: 'Underwriting', shortDesc: 'Credit officer case review' },
  { id: 'approval', number: 6, title: 'Approval', shortDesc: 'Sanction authorization' },
  { id: 'disbursement', number: 7, title: 'Disbursement', shortDesc: 'Direct bank payout' },
];

export interface LoanJourneySidebarProps {
  status?: string;
  applicationNumber?: string;
  requestedAmount?: number | string | null;
  activeStageId?: LoanStageId;
  verificationSummary?: VerificationSummary | null;
  currentVerificationStep?: number;
  onNavigateStage?: (stageId: LoanStageId) => void;
  actionRequiredReason?: string | null;
  className?: string;
}

export const getStageState = (
  stageId: LoanStageId,
  status?: string,
  verifSummary?: VerificationSummary | null
): 'completed' | 'current' | 'upcoming' | 'action_required' | 'rejected' => {
  const normStatus = (status || 'DRAFT').toUpperCase();

  // Status mapping weights
  const statusWeight: Record<string, number> = {
    DRAFT: 1,
    SUBMITTED: 1.5,
    ELIGIBILITY_CHECKED: 2,
    OFFER_SELECTED: 4, // In verification
    UNDER_REVIEW: 5,
    APPROVED: 6,
    DISBURSEMENT_PROCESSING: 7,
    DISBURSED: 7.5,
    REJECTED: 99,
  };

  const currentWeight = statusWeight[normStatus] ?? 1;

  // Check action required conditions during verification / underwriting
  const hasActionRequired =
    verifSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ||
    verifSummary?.kyc === 'FAILED' ||
    verifSummary?.bank_account === 'FAILED';

  if (stageId === 'verification' && hasActionRequired) {
    return 'action_required';
  }

  if (normStatus === 'REJECTED') {
    if (stageId === 'underwriting' || stageId === 'eligibility') return 'rejected';
  }

  switch (stageId) {
    case 'application':
      if (currentWeight > 1) return 'completed';
      return 'current';

    case 'eligibility':
      if (currentWeight > 2) return 'completed';
      if (currentWeight >= 1.5 && currentWeight <= 2) return 'current';
      return 'upcoming';

    case 'offers':
      if (currentWeight > 4) return 'completed';
      if (currentWeight === 4 && (!verifSummary || verifSummary.status === 'NOT_STARTED')) {
        return 'current';
      }
      if (currentWeight >= 2 && currentWeight < 4) return 'current';
      return currentWeight > 4 ? 'completed' : 'upcoming';

    case 'verification':
      if (currentWeight >= 5) return 'completed';
      if (currentWeight === 4) return 'current';
      return 'upcoming';

    case 'underwriting':
      if (currentWeight >= 6) return 'completed';
      if (currentWeight === 5) return 'current';
      return 'upcoming';

    case 'approval':
      if (currentWeight >= 7) return 'completed';
      if (currentWeight === 6) return 'current';
      return 'upcoming';

    case 'disbursement':
      if (normStatus === 'DISBURSED') return 'completed';
      if (normStatus === 'DISBURSEMENT_PROCESSING') return 'current';
      return 'upcoming';

    default:
      return 'upcoming';
  }
};

export const LoanJourneySidebar: React.FC<LoanJourneySidebarProps> = ({
  status,
  applicationNumber,
  requestedAmount,
  verificationSummary,
  currentVerificationStep = 1,
  actionRequiredReason,
  className = '',
}) => {
  const normStatus = (status || 'DRAFT').toUpperCase();
  const isVerificationActive = normStatus === 'OFFER_SELECTED';

  return (
    <aside
      className={`w-full lg:w-[280px] shrink-0 bg-white border-r border-[#E5E2DC] flex flex-col justify-between py-6 px-4 sm:px-5 select-none ${className}`}
    >
      <div className="space-y-6">
        {/* Loan Header Reference */}
        <div className="p-3.5 bg-[#FAF8F5] border border-[#EAE7E1] rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B5652D]">
              Loan Application
            </span>
            <span className="text-[11px] font-mono font-semibold text-[#686D76]">
              {applicationNumber ? `#${applicationNumber}` : 'Draft'}
            </span>
          </div>

          {requestedAmount && (
            <div className="pt-0.5">
              <span className="text-[11px] text-[#686D76] block">Requested Principal</span>
              <span className="text-lg font-bold text-[#14161A] font-mono">
                ₹{Number(requestedAmount).toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        {/* Journey Heading */}
        <div className="px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#8A8D93] block">
            Loan Journey
          </span>
          <span className="text-xs text-[#686D76]">7-Stage Digital Lending Pipeline</span>
        </div>

        {/* 7-Stage Stepper List */}
        <nav aria-label="Loan Journey Stages" className="space-y-1.5">
          {LOAN_STAGES.map((stage) => {
            const state = getStageState(stage.id, status, verificationSummary);
            const isCurrent = state === 'current';
            const isCompleted = state === 'completed';
            const isActionRequired = state === 'action_required';
            const isRejected = state === 'rejected';

            return (
              <div key={stage.id} className="relative">
                <div
                  className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-[#FAF3EE] border border-[#F3D7C4] text-[#14161A] shadow-xs'
                      : isActionRequired
                      ? 'bg-[#FDF6EC] border border-[#F3E1C5] text-[#A8752B]'
                      : isRejected
                      ? 'bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32]'
                      : isCompleted
                      ? 'text-[#14161A] hover:bg-[#F7F5F1]'
                      : 'text-[#8A8D93] opacity-80'
                  }`}
                >
                  {/* Step Indicator Icon */}
                  <div className="shrink-0 mt-0.5">
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-[#E8F2EE] border border-[#C5E0D5] text-[#1E5C4A] flex items-center justify-center text-xs font-bold shadow-xs">
                        ✓
                      </div>
                    ) : isActionRequired ? (
                      <div className="w-6 h-6 rounded-full bg-[#FBEFEC] border border-[#F0D0CB] text-[#8C3A32] flex items-center justify-center text-xs font-bold animate-pulse">
                        ⚠️
                      </div>
                    ) : isRejected ? (
                      <div className="w-6 h-6 rounded-full bg-[#8C3A32] text-white flex items-center justify-center text-xs font-bold">
                        ✕
                      </div>
                    ) : isCurrent ? (
                      <div className="w-6 h-6 rounded-full bg-[#B5652D] text-white flex items-center justify-center text-xs font-bold shadow-xs ring-4 ring-[#B5652D]/15">
                        {stage.number}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#F0EEE9] border border-[#E5E2DC] text-[#8A8D93] flex items-center justify-center text-xs font-semibold">
                        {stage.number}
                      </div>
                    )}
                  </div>

                  {/* Title & Stage Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs font-bold tracking-tight block truncate ${
                          isCurrent
                            ? 'text-[#B5652D]'
                            : isCompleted
                            ? 'text-[#14161A]'
                            : isActionRequired
                            ? 'text-[#A8752B]'
                            : 'text-[#686D76]'
                        }`}
                      >
                        {stage.title}
                      </span>

                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#B5652D] text-white shrink-0">
                          Active
                        </span>
                      )}

                      {isActionRequired && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-[#8C3A32] text-white shrink-0">
                          Action
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-[#8A8D93] block truncate">
                      {stage.shortDesc}
                    </span>

                    {/* Sub-steps breakdown during Verification Stage */}
                    {stage.id === 'verification' && isVerificationActive && (
                      <div className="mt-2.5 pl-2 border-l-2 border-[#B5652D]/30 space-y-1.5 py-1">
                        {[
                          { step: 1, label: 'Identity & PDF Document' },
                          { step: 2, label: 'Bank Account (IFSC)' },
                          { step: 3, label: 'Live Photo Capture' },
                          { step: 4, label: 'Final Declaration' },
                        ].map((sub) => {
                          const isSubActive = currentVerificationStep === sub.step;
                          const isSubDone = currentVerificationStep > sub.step;

                          return (
                            <div
                              key={sub.step}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                  isSubDone
                                    ? 'bg-[#1E5C4A] text-white'
                                    : isSubActive
                                    ? 'bg-[#B5652D] text-white ring-2 ring-[#B5652D]/20'
                                    : 'bg-[#E5E2DC] text-[#686D76]'
                                }`}
                              >
                                {isSubDone ? '✓' : sub.step}
                              </span>
                              <span
                                className={`${
                                  isSubActive
                                    ? 'font-bold text-[#14161A]'
                                    : isSubDone
                                    ? 'text-[#1E5C4A] font-medium'
                                    : 'text-[#8A8D93]'
                                }`}
                              >
                                {sub.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Action Required Banner in Sidebar if applicable */}
        {actionRequiredReason && (
          <div className="p-3 bg-[#FBEFEC] border border-[#F0D0CB] rounded-xl text-xs space-y-1">
            <span className="font-bold text-[#8C3A32] block flex items-center gap-1">
              <span>⚠️</span> Action Required
            </span>
            <p className="text-[11px] text-[#8C3A32] leading-snug">{actionRequiredReason}</p>
          </div>
        )}
      </div>

      {/* Footer Support Card */}
      <div className="pt-6 border-t border-[#E5E2DC] mt-6 text-[11px] text-[#8A8D93] space-y-1">
        <span className="font-bold text-[#14161A] block">Digital Lending Support</span>
        <p>Questions about your loan application? Our credit officers are available 24/7.</p>
        <span className="font-mono text-[#B5652D] block font-semibold">support@ezfinanz.com</span>
      </div>
    </aside>
  );
};
