// src/components/shared/ErrorBoundary.js
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import secureLogger from '../../utils/secureLogger';
import './ErrorBoundary.css';

/**
 * ErrorBoundary - Catch React errors and display fallback UI
 * Prevents entire app from crashing when a component fails
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to our logging service
    secureLogger.error('ErrorBoundary caught an error', {
      error: error.message,
      errorStack: error.stack,
      componentStack: errorInfo.componentStack,
      boundaryName: this.props.name || 'Unknown'
    });

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // If a reset callback was provided, call it
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <AlertTriangle size={48} className="error-boundary-icon" />
            <h2 className="error-boundary-title">
              {this.props.errorTitle || 'Something went wrong'}
            </h2>
            <p className="error-boundary-message">
              {this.props.errorMessage || 'An unexpected error occurred. Please try again.'}
            </p>
            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Error Details</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <button
              className="error-boundary-button"
              onClick={this.handleReset}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
