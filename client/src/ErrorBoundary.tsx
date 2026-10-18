import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { failed: boolean };

// Last line of defence: show a way out instead of a blank page if rendering ever throws.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1rem' }}>
        <div>
          <h1>Something went wrong</h1>
          <p>Reloading usually fixes it. Your game is kept by the server.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    );
  }
}
