import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'subtle' | 'accent';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-6 sm:p-8',
  };

  const variantStyles = {
    default: 'bg-white border border-[#E5E2DC] shadow-[0_1px_3px_rgba(20,22,26,0.04)] text-[#14161A]',
    elevated: 'bg-white border border-[#E5E2DC] shadow-[0_4px_16px_rgba(20,22,26,0.06)] text-[#14161A]',
    subtle: 'bg-[#F2EFE9]/70 border border-[#E2DFD8] text-[#14161A]',
    accent: 'bg-white border border-[#B5652D]/30 shadow-[0_2px_10px_rgba(181,101,45,0.06)] text-[#14161A]',
  };

  return (
    <div
      className={`rounded-xl transition-all ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tagline?: string;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  action,
  tagline,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E2DC] pb-4 mb-5 ${className}`}>
      <div>
        {tagline && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#B5652D] block mb-1">
            {tagline}
          </span>
        )}
        <h3 className="text-lg font-bold text-[#14161A] tracking-tight font-editorial">{title}</h3>
        {description && <p className="text-xs text-[#686D76] mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};
