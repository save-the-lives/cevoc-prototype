import React, { useEffect, useRef } from 'react';

// Lightweight components following NSW Design System patterns (nsw-* class names).

export function Link({ to, className, children, ...rest }) {
  return (
    <a href={`#${to}`} className={className} {...rest}>
      {children}
    </a>
  );
}

export function Button({ variant = 'dark', className = '', ...rest }) {
  return <button type="button" className={`nsw-button nsw-button--${variant} ${className}`} {...rest} />;
}

export function Alert({ type = 'info', title, children, role }) {
  return (
    <div className={`nsw-in-page-alert nsw-in-page-alert--${type}`} role={role || (type === 'error' ? 'alert' : 'status')}>
      <div className="nsw-in-page-alert__content">
        {title && <h3 className="nsw-in-page-alert__title">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

const STATUS_LABEL = {
  published: ['success', 'Published'],
  current: ['success', 'In force'],
  expired: ['grey', 'Expired'],
  withdrawn: ['warning', 'Withdrawn'],
  restricted: ['info', 'Restricted'],
  future: ['info', 'Future capability'],
  unavailable: ['error', 'Unavailable'],
};

export function StatusTag({ status, label }) {
  const [tone, text] = STATUS_LABEL[status] || ['grey', status];
  return <span className={`nsw-status-label nsw-status-label--${tone}`}>{label || text}</span>;
}

export function Breadcrumbs({ items }) {
  return (
    <nav className="nsw-breadcrumbs" aria-label="Breadcrumbs">
      <ol>
        {items.map(([label, to], i) => (
          <li key={label}>{i < items.length - 1 ? <Link to={to}>{label}</Link> : <span aria-current="page">{label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function Steps({ current, steps }) {
  return (
    <ol className="nsw-steps" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className={i + 1 < current ? 'is-done' : i + 1 === current ? 'is-current' : ''} aria-current={i + 1 === current ? 'step' : undefined}>
          <span className="nsw-steps__num">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export function Field({ id, label, hint, error, children }) {
  return (
    <div className={`nsw-form__group ${error ? 'has-error' : ''}`}>
      <label className="nsw-form__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span className="nsw-form__helper" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="nsw-form__helper nsw-form__helper--error" id={`${id}-error`}>
          {error}
        </span>
      )}
      {children}
    </div>
  );
}

export function Loading({ text = 'Loading' }) {
  return (
    <p className="cevoc-loading" role="status" aria-live="polite">
      <span className="cevoc-spinner" aria-hidden="true" />
      {text}…
    </p>
  );
}

export function SummaryList({ rows }) {
  return (
    <dl className="cevoc-summary">
      {rows.filter(Boolean).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Dialog({ title, onClose, children, wide }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev && prev.focus && prev.focus();
    };
  }, [onClose]);
  return (
    <div className="nsw-dialog" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`nsw-dialog__wrapper ${wide ? 'is-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="nsw-dialog__top">
          <h2 id="dialog-title">{title}</h2>
          <button ref={closeRef} type="button" className="nsw-dialog__close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="nsw-dialog__content">{children}</div>
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  if (error?.name === 'UpstreamError')
    return (
      <Alert type="error" title="This information is temporarily unavailable">
        <p>We can't reach the system that holds this information right now. Nothing is wrong with your details. Try again in a few minutes.</p>
        {onRetry && <Button variant="dark-outline" onClick={onRetry}>Try again</Button>}
      </Alert>
    );
  return (
    <Alert type="error" title="Something went wrong">
      <p>{String(error?.message || error)}</p>
    </Alert>
  );
}
