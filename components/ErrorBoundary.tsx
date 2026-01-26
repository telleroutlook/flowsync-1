import React, { Component, ErrorInfo, ReactNode, memo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

const DefaultFallback = memo<{ error?: Error; onReset: () => void }>(({ error, onReset }) => (
  <div className="flex items-center justify-center min-h-[400px] p-6">
    <div className="text-center max-w-md">
      <div className="w-16 h-16 bg-negative/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-bold text-text-primary mb-2">Something went wrong</h2>
      <p className="text-sm text-secondary mb-4">
        {error?.message || 'An unexpected error occurred. Please try refreshing the page.'}
      </p>
      <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
        Try again
      </button>
    </div>
  </div>
));
DefaultFallback.displayName = 'DefaultFallback';

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// Functional wrapper for convenience
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const Wrapped = memo((props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  ));
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return Wrapped;
};
