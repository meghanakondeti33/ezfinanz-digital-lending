import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, className = '', id, required, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={selectId} className="block text-sm font-semibold text-[#14161A]">
              {label} {required && <span className="text-[#B5652D] font-bold">*</span>}
            </label>
            {hint && <span className="text-xs text-[#686D76]">{hint}</span>}
          </div>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            className={`w-full appearance-none bg-white border rounded-xl py-2.5 px-3.5 pr-10 text-sm sm:text-base text-[#14161A] transition-colors focus:outline-none focus:ring-2 cursor-pointer ${
              error
                ? 'border-[#8C3A32] focus:border-[#8C3A32] focus:ring-[#8C3A32]/10 bg-[#FBEFEC]/30'
                : 'border-[#D4D0C7] focus:border-[#B5652D] focus:ring-[#B5652D]/15'
            } ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Custom Chevron Caret */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-[#686D76]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
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

Select.displayName = 'Select';
