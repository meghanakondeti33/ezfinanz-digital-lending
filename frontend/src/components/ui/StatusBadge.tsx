import React from 'react';
import type { ApplicationStatus } from '../../types/loan';

export interface StatusBadgeProps {
  status: ApplicationStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  className = '',
}) => {
  const getStatusConfig = (st: string) => {
    switch (st) {
      case 'DRAFT':
        return {
          label: 'Draft Saved',
          dot: 'bg-[#686D76]',
          style: 'bg-[#EFECE6] border-[#D4D0C7] text-[#4D515A]',
        };
      case 'SUBMITTED':
        return {
          label: 'Application Submitted',
          dot: 'bg-[#B5652D]',
          style: 'bg-[#F9F3EE] border-[#ECCBB3] text-[#9C4F1C]',
        };
      case 'ELIGIBILITY_CHECKED':
        return {
          label: 'Eligibility Checked',
          dot: 'bg-[#1E5C4A]',
          style: 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A]',
        };
      case 'OFFER_SELECTED':
        return {
          label: 'Plan Selected',
          dot: 'bg-[#B5652D]',
          style: 'bg-[#F9F3EE] border-[#ECCBB3] text-[#9C4F1C]',
        };
      case 'UNDER_REVIEW':
        return {
          label: 'Application Under Review',
          dot: 'bg-[#A8752B]',
          style: 'bg-[#FDF6EC] border-[#F3E1C5] text-[#A8752B] font-medium',
        };
      case 'APPROVED':
        return {
          label: 'Loan Approved',
          dot: 'bg-[#1E5C4A]',
          style: 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A] font-semibold',
        };
      case 'DISBURSEMENT_PROCESSING':
        return {
          label: 'Money Being Transferred',
          dot: 'bg-[#A8752B] animate-pulse',
          style: 'bg-[#FDF6EC] border-[#F3E1C5] text-[#A8752B] font-medium',
        };
      case 'DISBURSED':
        return {
          label: 'Disbursed & Settled',
          dot: 'bg-[#1E5C4A]',
          style: 'bg-[#E8F2EE] border-[#C5E0D5] text-[#1E5C4A] font-bold',
        };
      case 'REJECTED':
        return {
          label: 'Application Declined',
          dot: 'bg-[#8C3A32]',
          style: 'bg-[#FBEFEC] border-[#F0D0CB] text-[#8C3A32]',
        };
      default:
        return {
          label: st.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          dot: 'bg-[#686D76]',
          style: 'bg-[#EFECE6] border-[#D4D0C7] text-[#4D515A]',
        };
    }
  };

  const config = getStatusConfig(status);

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs sm:text-sm',
    lg: 'px-4 py-1.5 text-sm sm:text-base',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.style} ${sizeStyles[size]} ${className}`}
    >
      {showDot && <span className={`h-2 w-2 rounded-full shrink-0 ${config.dot}`} />}
      <span className="truncate">{config.label}</span>
    </span>
  );
};
