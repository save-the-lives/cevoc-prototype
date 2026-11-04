import { useId, useRef } from 'react';

// A date read off a letter: three plain number boxes (day, month, year). Errors are announced and tied to the fields;
// nothing relies on colour alone. `bad` lists which boxes to mark.
export default function DateField({ id, legend, hint, parts, onChange, error, bad = [], onBlurField }) {
  const uid = useId();
  const refs = { d: useRef(null), m: useRef(null), y: useRef(null) };
  const set = (k, v, len) => {
    const clean = v.replace(/\D/g, '').slice(0, len);
    onChange({ ...parts, [k]: clean });
    if (clean.length === len && k !== 'y') refs[k === 'd' ? 'm' : 'y'].current?.focus();
  };
  const described = `${uid}-h${error ? ` ${uid}-e` : ''}`;
  const box = (k, label, len, cls) => (
    <div className="df-part">
      <label htmlFor={`${id}-${k}`}>{label}</label>
      <input id={`${id}-${k}`} ref={refs[k]} className={`df-in ${cls}${bad.includes(k) ? ' is-bad' : ''}`} inputMode="numeric"
        autoComplete={k === 'd' ? 'bday-day' : 'off'} maxLength={len + 2} value={parts[k]}
        aria-invalid={bad.includes(k) || undefined} aria-describedby={described}
        onChange={(e) => set(k, e.target.value, len)} onBlur={() => onBlurField?.()} />
    </div>
  );
  return (
    <fieldset className={`df${error ? ' has-error' : ''}`} id={id}>
      <legend>{legend}</legend>
      <p className="df-hint" id={`${uid}-h`}>{hint}</p>
      {error && <p className="field-err" id={`${uid}-e`} role="alert"><span aria-hidden="true">⚠ </span><span className="sr-only">Error: </span>{error}</p>}
      <div className="df-row">{box('d', 'Day', 2, 'sm')}{box('m', 'Month', 2, 'sm')}{box('y', 'Year', 4, 'lg')}</div>
    </fieldset>
  );
}
