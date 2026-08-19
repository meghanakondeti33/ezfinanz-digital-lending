import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftAddon, rightAddon, className = '', id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={inputId} className="block text-sm font-semibold text-[#14161A]">
              {label} {required && <span className="text-[#B5652D] font-bold">*</span>}
            </label>
            {hint && <span className="text-xs text-[#686D76]">{hint}</span>}
          </div>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#686D76] text-sm">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full bg-white border rounded-xl py-2.5 px-3.5 text-sm sm:text-base text-[#14161A] placeholder-[#8A8D93] transition-colors focus:outline-none focus:ring-2 ${
              error
                ? 'border-[#8C3A32] focus:border-[#8C3A32] focus:ring-[#8C3A32]/10 bg-[#FBEFEC]/30'
                : 'border-[#D4D0C7] focus:border-[#B5652D] focus:ring-[#B5652D]/15'
            } ${leftAddon ? 'pl-9' : ''} ${rightAddon ? 'pr-9' : ''} ${className}`}
            {...props}
          />

          {rightAddon && (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-[#686D76] text-sm">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-[#8C3A32] flex items-center gap-1 font-medium mt-1">
            <span>•</span>
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
