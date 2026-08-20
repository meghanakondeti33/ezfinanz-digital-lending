import React, { useState } from 'react';
import { AppHeader } from './AppHeader';
import {
  LoanJourneySidebar,
  LOAN_STAGES,
  getStageState,
  type LoanStageId,
} from '../journey/LoanJourneySidebar';
import { CustomerWorkspaceSidebar } from './CustomerWorkspaceSidebar';
import type { VerificationSummary } from '../../types/verification';

export interface CustomerLayoutProps {
  children: React.ReactNode;
  status?: string;
  applicationNumber?: string;
  requestedAmount?: number | string | null;
  activeStageId?: LoanStageId;
  verificationSummary?: VerificationSummary | null;
  currentVerificationStep?: number;
  actionRequiredReason?: string | null;
  showSidebar?: boolean;
  sidebarMode?: 'workspace' | 'journey';
  primaryApplicationId?: string;
  activeNav?: string;
  onSelectNav?: (nav: string) => void;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({
  children,
  status,
  applicationNumber,
  requestedAmount,
  activeStageId,
  verificationSummary,
  currentVerificationStep = 1,
  actionRequiredReason,
  showSidebar = true,
  sidebarMode = 'journey',
  primaryApplicationId,
  activeNav,
  onSelectNav,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Compute current stage index & details for mobile progress header
  let currentStageDef = LOAN_STAGES[0];
  if (activeStageId) {
    currentStageDef = LOAN_STAGES.find((s) => s.id === activeStageId) || LOAN_STAGES[0];
  } else if (status) {
    for (const st of LOAN_STAGES) {
      const state = getStageState(st.id, status, verificationSummary);
      if (state === 'current' || state === 'action_required') {
        currentStageDef = st;
        break;
      }
    }
  }

  const currentStepNumber = currentStageDef.number;
  const progressPercent = Math.round((currentStepNumber / 7) * 100);

  const hasActionRequired =
    verificationSummary?.selfie === 'PHOTO_RETAKE_REQUIRED' ||
    verificationSummary?.kyc === 'FAILED' ||
    verificationSummary?.bank_account === 'FAILED';

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-[#14161A] flex flex-col font-sans selection:bg-[#B5652D]/20">
      {/* Top Application Header */}
      <AppHeader
        showSidebarToggle={showSidebar}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      {/* Mobile Compact Progress Bar Header (Only when in journey mode with active application) */}
      {showSidebar && sidebarMode === 'journey' && (
        <div className="lg:hidden bg-white border-b border-[#E5E2DC] px-4 py-3 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#FAF3EE] border border-[#F3D7C4] text-[#B5652D] text-[10px] font-mono font-bold uppercase tracking-wider">
                Step {currentStepNumber} of 7
              </span>
              <span className="text-xs font-bold text-[#14161A]">
                {currentStageDef.title}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="text-[11px] font-semibold text-[#B5652D] hover:underline cursor-pointer flex items-center gap-1"
            >
              View Journey ▾
            </button>
          </div>

          {/* Mini Linear Progress Bar */}
          <div className="w-full bg-[#EAE7E1] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#B5652D] h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Dual-Pane Layout */}
      <div className="flex-1 w-full flex flex-col lg:flex-row">
        {/* Desktop Left Sidebar (260px) */}
        {showSidebar && (
          <aside className="hidden lg:block shrink-0 w-[260px] bg-white border-r border-[#E5E2DC]">
            <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
              {sidebarMode === 'workspace' ? (
                <CustomerWorkspaceSidebar
                  primaryApplicationId={primaryApplicationId}
                  hasActiveApplication={!!primaryApplicationId}
                  hasActionRequired={hasActionRequired}
                  activeNav={activeNav}
                  onSelectNav={onSelectNav}
                  className="border-r-0"
                />
              ) : (
                <LoanJourneySidebar
                  status={status}
                  applicationNumber={applicationNumber}
                  requestedAmount={requestedAmount}
                  activeStageId={activeStageId}
                  verificationSummary={verificationSummary}
                  currentVerificationStep={currentVerificationStep}
                  actionRequiredReason={actionRequiredReason}
                  className="h-full border-r-0"
                />
              )}
            </div>
          </aside>
        )}

        {/* Mobile Slide-Over Drawer */}
        {showSidebar && mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />

            {/* Sidebar drawer content */}
            <div className="relative w-full max-w-xs bg-white shadow-2xl h-full flex flex-col z-10">
              <div className="p-4 border-b border-[#E5E2DC] flex items-center justify-between">
                <span className="font-bold text-sm text-[#14161A] font-editorial">
                  {sidebarMode === 'workspace' ? 'Borrower Navigation' : 'Loan Journey Tracker'}
                </span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-[#686D76] hover:bg-[#F7F5F1] cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {sidebarMode === 'workspace' ? (
                  <CustomerWorkspaceSidebar
                    primaryApplicationId={primaryApplicationId}
                    hasActiveApplication={!!primaryApplicationId}
                    hasActionRequired={hasActionRequired}
                    activeNav={activeNav}
                    onSelectNav={(nav) => {
                      if (onSelectNav) onSelectNav(nav);
                      setMobileSidebarOpen(false);
                    }}
                    className="border-r-0"
                  />
                ) : (
                  <LoanJourneySidebar
                    status={status}
                    applicationNumber={applicationNumber}
                    requestedAmount={requestedAmount}
                    activeStageId={activeStageId}
                    verificationSummary={verificationSummary}
                    currentVerificationStep={currentVerificationStep}
                    actionRequiredReason={actionRequiredReason}
                    className="border-r-0"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Center / Main Content Area (Full-width workspace matching Admin quality) */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;
