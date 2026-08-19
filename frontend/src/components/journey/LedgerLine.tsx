import React from 'react';
import type { ApplicationStatus } from '../../types/loan';

export type JourneyStageId =
  | 'APPLICATION'
  | 'ELIGIBILITY'
  | 'OFFER'
  | 'VERIFICATION'
  | 'REVIEW'
  | 'APPROVAL'
  | 'DISBURSEMENT';

export interface JourneyStage {
  id: JourneyStageId;
  name: string;
  shortLabel: string;
  description: string;
}

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    id: 'APPLICATION',
    name: 'Application',
    shortLabel: 'Application',
    description: 'Loan requirement & background',
  },
  {
    id: 'ELIGIBILITY',
    name: 'Eligibility',
    shortLabel: 'Eligibility',
    description: 'Instant credit score & limit',
  },
  {
    id: 'OFFER',
    name: 'Offer Selection',
    shortLabel: 'Offer',
    description: 'Structure EMI & tenure',
  },
  {
    id: 'VERIFICATION',
    name: 'Verification',
    shortLabel: 'Verification',
    description: 'KYC, bank, photo & consent',
  },
  {
    id: 'REVIEW',
    name: 'Underwriting',
    shortLabel: 'Review',
    description: 'Risk assessment & file review',
  },
  {
    id: 'APPROVAL',
    name: 'Approval',
    shortLabel: 'Approval',
    description: 'Credit authorized',
  },
  {
    id: 'DISBURSEMENT',
    name: 'Disbursement',
    shortLabel: 'Disbursement',
    description: 'Settlement to bank account',
  },
];

export interface LedgerLineProps {
  status?: ApplicationStatus | string;
  currentStage?: JourneyStageId;
  className?: string;
  compact?: boolean;
}

export const getStageFromStatus = (status?: ApplicationStatus | string): JourneyStageId => {
  if (!status) return 'APPLICATION';
  switch (status) {
    case 'DRAFT':
    case 'SUBMITTED':
      return 'APPLICATION';
    case 'ELIGIBILITY_CHECKED':
      return 'OFFER';
    case 'OFFER_SELECTED':
      return 'VERIFICATION';
    case 'UNDER_REVIEW':
      return 'REVIEW';
    case 'APPROVED':
      return 'APPROVAL';
    case 'DISBURSEMENT_PROCESSING':
    case 'DISBURSED':
      return 'DISBURSEMENT';
    default:
      return 'APPLICATION';
  }
};

export const LedgerLine: React.FC<LedgerLineProps> = ({
  status,
  currentStage,
  className = '',
  compact = false,
}) => {
  const activeStageId = currentStage || getStageFromStatus(status);
  const isRejected = status === 'REJECTED';

  const stageIndexMap: Record<JourneyStageId, number> = {
    APPLICATION: 0,
    ELIGIBILITY: 1,
    OFFER: 2,
    VERIFICATION: 3,
    REVIEW: 4,
    APPROVAL: 5,
    DISBURSEMENT: 6,
  };

  const currentIndex = stageIndexMap[activeStageId] ?? 0;
  const activeStage = JOURNEY_STAGES[currentIndex];

  return (
    <div className={`w-full bg-white border border-[#E5E2DC] rounded-xl p-4 sm:p-6 shadow-sm ${className}`}>
      {/* Header bar showing where customer is */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-[#E5E2DC] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B5652D] bg-[#F9F3EE] border border-[#ECCBB3] px-2 py-0.5 rounded">
            The Ledger Line
          </span>
          <span className="text-xs text-[#686D76]">
            Waypoint {currentIndex + 1} of {JOURNEY_STAGES.length}
          </span>
        </div>

        <div className="text-xs font-semibold text-[#14161A] flex items-center gap-1.5">
          <span className="text-[#8A8D93] font-normal">Current stage:</span>
          <span className="text-[#14161A] font-bold">{activeStage.name}</span>
          {isRejected && <span className="text-[#8C3A32] font-bold">(Declined)</span>}
        </div>
      </div>

      {/* Waypoint Rail */}
      <div className="relative">
        {/* Background Track Line */}
        <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-[#E5E2DC] hidden md:block" />

        {/* Progress Bar Active Line in Molten Copper */}
        <div
          className="absolute top-3.5 left-4 h-0.5 bg-[#B5652D] transition-all duration-500 hidden md:block"
          style={{
            width: `calc(${(currentIndex / (JOURNEY_STAGES.length - 1)) * 100}% - 2rem)`,
          }}
        />

        {/* Waypoints */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 md:gap-1 relative z-10">
          {JOURNEY_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;

            return (
              <div
                key={stage.id}
                className={`flex flex-col md:items-center text-left md:text-center transition-all p-2 rounded-lg ${
                  isCurrent ? 'bg-[#F9F3EE]/80 md:bg-transparent' : ''
                }`}
              >
                {/* Node Waypoint Icon */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all mb-2 ${
                    isCompleted
                      ? 'bg-[#14161A] text-white'
                      : isCurrent
                      ? isRejected
                        ? 'bg-[#8C3A32] text-white ring-4 ring-[#8C3A32]/20'
                        : 'bg-[#B5652D] text-white ring-4 ring-[#B5652D]/20 shadow-sm'
                      : 'bg-[#F2EFE9] text-[#8A8D93] border border-[#D4D0C7]'
                  }`}
                >
                  {isCompleted ? (
                    '✓'
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Waypoint Text */}
                <div className="space-y-0.5">
                  <span
                    className={`block text-xs font-semibold leading-snug ${
                      isCurrent
                        ? 'text-[#B5652D] font-bold'
                        : isCompleted
                        ? 'text-[#14161A]'
                        : 'text-[#8A8D93]'
                    }`}
                  >
                    {compact ? stage.shortLabel : stage.name}
                  </span>

                  {!compact && (
                    <span className="hidden lg:block text-[10px] text-[#686D76] leading-tight">
                      {stage.description}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
