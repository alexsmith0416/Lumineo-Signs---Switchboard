import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

// Top-level safety net. Without this, a render-time throw anywhere in the tree
// unmounts everything and leaves a blank white screen (hard to diagnose in the
// deployed Code App). This catches it and shows the actual error + stack.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught:", error, info);
    this.setState({ error, info });
  }

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          padding: "24px",
          margin: "24px",
          maxWidth: "900px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "#7a1f1f",
          background: "#fff5f5",
          border: "1px solid #f0c0c0",
          borderRadius: "8px",
        }}
      >
        <h1 style={{ fontSize: "18px", marginTop: 0 }}>Something went wrong</h1>
        <p style={{ color: "#444" }}>
          The app hit an error while rendering. The details below are the actual
          error — send them over and they&apos;ll pin down the fix.
        </p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#fff",
            border: "1px solid #e0d0d0",
            borderRadius: "6px",
            padding: "12px",
            fontSize: "13px",
            color: "#333",
          }}
        >
          {error.message}
          {"\n\n"}
          {error.stack}
          {info?.componentStack ? "\n\nComponent stack:" + info.componentStack : ""}
        </pre>
      </div>
    );
  }
}
