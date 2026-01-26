import React, { memo } from 'react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
  type?: 'error' | 'warning' | 'info';
}

const alertStyles = {
  error: 'border-negative/20 bg-negative/10 text-negative',
  warning: 'border-critical/20 bg-critical/10 text-critical',
  info: 'border-primary/20 bg-primary/10 text-primary',
};

const iconSvg = {
  error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

export const ErrorAlert = memo<ErrorAlertProps>(({ message, onDismiss, type = 'error' }) => {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onDismiss?.();
    }
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm font-medium flex items-start gap-2 ${alertStyles[type]}`} role="alert">
      <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconSvg[type]} />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          onKeyDown={handleKeyDown}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});
ErrorAlert.displayName = 'ErrorAlert';

export const LoadingSpinner = memo<{ size?: 'sm' | 'md' | 'lg'; className?: string }>(({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${sizeClasses[size]} text-primary`}
        fill="none"
        viewBox="0 0 24 24"
        role="status"
        aria-label="Loading"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
});
LoadingSpinner.displayName = 'LoadingSpinner';
