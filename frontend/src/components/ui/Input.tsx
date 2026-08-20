import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  helperText?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, helperText, error, leftAddon, rightAddon, className = '', id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={inputId} className="block text-xs sm:text-sm font-semibold text-[#14161A]">
              {label} {required && <span className="text-[#B5652D] font-bold">*</span>}
            </label>
            {hint && <span className="text-xs text-[#8A8D93]">{hint}</span>}
          </div>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#686D76] font-semibold text-sm sm:text-base select-none">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            className={`w-full bg-white border rounded-xl py-3 px-3.5 text-sm sm:text-base text-[#14161A] placeholder-[#8A8D93]/70 transition-all focus:outline-none focus:ring-2 min-h-[48px] ${
              error
                ? 'border-[#8C3A32] focus:border-[#8C3A32] focus:ring-[#8C3A32]/15 bg-[#FBEFEC]/30'
                : 'border-[#D4D0C7] focus:border-[#B5652D] focus:ring-[#B5652D]/15'
            } ${leftAddon ? 'pl-9 sm:pl-10' : ''} ${rightAddon ? 'pr-9 sm:pr-10' : ''} ${className}`}
            {...props}
          />

          {rightAddon && (
            <div className="absolute right-3.5 flex items-center pointer-events-none text-[#686D76] text-sm select-none">
              {rightAddon}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-xs text-[#8C3A32] flex items-center gap-1 font-medium mt-1">
            <span>⚠️</span>
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-[#686D76] mt-1 leading-relaxed">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
