import React from 'react';

// Catches render errors so the page shows what went wrong instead of going blank.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('CEVOC prototype error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="nsw-container cevoc-page">
        <h1>Something went wrong on this page</h1>
        <div className="nsw-in-page-alert nsw-in-page-alert--error" role="alert">
          <div className="nsw-in-page-alert__content">
            <h3 className="nsw-in-page-alert__title">Prototype error</h3>
            <p>This is a fault in the prototype, not in your details. Copy the message below when reporting it.</p>
            <pre className="cevoc-errortext">{String(error?.stack || error?.message || error)}</pre>
          </div>
        </div>
        <div className="cevoc-actions">
          <a className="nsw-button nsw-button--dark" href="#/">Go to the home page</a>
          <button type="button" className="nsw-button nsw-button--dark-outline" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
