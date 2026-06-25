import { Component, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode | ((error: Error) => ReactNode);
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

// Generic error boundary. Used both around the whole Grid and around each row's
// cells so a single cell/row that throws during render shows a fallback instead
// of crashing the entire app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return typeof this.props.fallback === 'function'
        ? (this.props.fallback as (e: Error) => ReactNode)(error)
        : this.props.fallback;
    }
    return this.props.children;
  }
}
