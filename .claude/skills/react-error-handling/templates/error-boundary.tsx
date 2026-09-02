import { Component, type ErrorInfo, type ReactNode } from 'react';

import { reportError } from '@/shared/lib/telemetry';

type FallbackProps = {
  error: Error;
  resetErrorBoundary: () => void;
};

type Props = {
  children: ReactNode;
  scope: string;
  FallbackComponent: (props: FallbackProps) => ReactNode;
};

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { scope: this.props.scope, componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return this.props.FallbackComponent({ error, resetErrorBoundary: this.reset });
  }
}
