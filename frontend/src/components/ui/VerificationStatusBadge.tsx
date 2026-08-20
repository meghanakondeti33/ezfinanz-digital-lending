import React from 'react';

export type VerificationType = 'KYC' | 'BANK' | 'LIVE_PHOTO' | 'DECLARATION' | 'DOCUMENT' | 'GENERAL';

interface VerificationStatusBadgeProps {
  status?: string | null;
  type?: VerificationType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const normalizeVerificationStatus = (
  rawStatus?: string | null
): {
  normalized: 'VERIFIED' | 'UNDER_REVIEW' | 'ACTION_REQUIRED' | 'NOT_SUBMITTED';
  label: string;
  variant: 'green' | 'amber' | 'red' | 'gray';
  icon: string;
} => {
  if (!rawStatus) {
    return {
      normalized: 'NOT_SUBMITTED',
      label: 'Not Submitted',
      variant: 'gray',
      icon: '○',
    };
  }

  const s = rawStatus.toUpperCase().trim();

  // Green / Verified / Approved
  if (
    s === 'VERIFIED' ||
    s === 'ACCEPTED' ||
    s === 'PHOTO_APPROVED' ||
    s === 'APPROVED' ||
    s === 'KYC_VERIFIED' ||
    s === 'COMPLETED'
  ) {
    return {
      normalized: 'VERIFIED',
      label: s === 'ACCEPTED' ? 'Accepted' : 'Verified',
      variant: 'green',
      icon: '✓',
    };
  }

  // Amber / In Progress / Pending Review
  if (
    s === 'SUBMITTED' ||
    s === 'UNDER_REVIEW' ||
    s === 'PHOTO_PENDING_REVIEW' ||
    s === 'PENDING' ||
    s === 'IN_PROGRESS' ||
    s === 'PENDING_REVIEW'
  ) {
    return {
      normalized: 'UNDER_REVIEW',
      label: 'Under Review',
      variant: 'amber',
      icon: '⏳',
    };
  }

  // Red / Rejection / Action Required / Retake
  if (
    s === 'REJECTED' ||
    s === 'ACTION_REQUIRED' ||
    s === 'PHOTO_RETAKE_REQUIRED' ||
    s === 'RETAKE_REQUIRED' ||
    s === 'KYC_REJECTED' ||
    s === 'FAILED'
  ) {
    return {
      normalized: 'ACTION_REQUIRED',
      label:
        s === 'PHOTO_RETAKE_REQUIRED' || s === 'RETAKE_REQUIRED'
          ? 'Retake Required'
          : s === 'KYC_REJECTED'
          ? 'Replacement Required'
          : 'Action Required',
      variant: 'red',
      icon: '⚠️',
    };
  }

  // Gray / Not Started / Not Submitted
  return {
    normalized: 'NOT_SUBMITTED',
    label: s === 'NOT_ACCEPTED' ? 'Not Accepted' : 'Not Submitted',
    variant: 'gray',
    icon: '○',
  };
};

export const VerificationStatusBadge: React.FC<VerificationStatusBadgeProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const { label, variant, icon } = normalizeVerificationStatus(status);

  const variantStyles = {
    green: 'bg-[#E8F2EE] text-[#1E5C4A] border-[#C5E0D5]',
    amber: 'bg-[#FDF6EC] text-[#A8752B] border-[#F3E1C5]',
    red: 'bg-[#FBEFEC] text-[#8C3A32] border-[#F0D0CB]',
    gray: 'bg-[#F2EFE9] text-[#686D76] border-[#E5E2DC]',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-bold',
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border shadow-2xs select-none transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      <span className="text-[11px] leading-none">{icon}</span>
      <span>{label}</span>
    </span>
  );
};

export default VerificationStatusBadge;
