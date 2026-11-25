import { go } from '../lib/router.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { UPLIFT_SAMPLES } from '../demo/uplift.js';
import { Button, Field, FieldError, FieldLabel, Header, HeaderBrand, Input, Masthead } from '@nswds/ui';

// PHASE 1 UPLIFT MOCK-UP (#/uplift): the legacy certificate search page (Customer Enquiry and Verification of
// Certificate), lifted and shifted. Same page, fields, defaults, buttons, columns and sorting as the legacy page;
// only the look changes. No new functions: no PDF download, no links in the results. Sample data only.
//
// Legacy behaviour kept: Date/Time from starts empty, Date/Time to defaults to now; SEARCH, CLEAR, CLOSE under the
// form; after a search, "Search results" with five columns (the last four sortable) and CLOSE moves below the table.

const FORMAT = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;
const pad = (n) => String(n).padStart(2, '0');
export const fmt = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const day = (d) => fmt(d).slice(0, 10);
export const parse = (s) => {
  const m = FORMAT.exec(String(s).trim());
  if (!m) return null;
  const [, d, mo, y, h, mi] = m.map(Number);
  const t = new Date(y, mo - 1, d, h, mi);
  return t.getDate() === d && t.getMonth() === mo - 1 && h < 24 && mi < 60 ? t : null;
};
export const parseDay = (s) => parse(`${s} 00:00`);
// <input type="datetime-local"> value <-> DD/MM/YYYY HH:MM
const toLocal = (s) => { const t = parse(s); return t ? `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}` : ''; };
const fromLocal = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : ''; };

// Sample certificates in the legacy results shape (invented dates). Same description and type wording as the
// legacy page; Period is the certificate cycle.
const DESC = 'Approved Traffic Enforcement Device';
const TYPE = 'Red Light Speed Camera';
const SAMPLE = [
  ['YEARLY', '12/08/2025', '12/08/2026'],
  ['QUARTERLY', '02/10/2025', '31/12/2025'],
  ['QUARTERLY', '22/12/2025', '21/03/2026'],
  ['QUARTERLY', '18/03/2026', '16/06/2026'],
  ['QUARTERLY', '12/06/2026', '10/09/2026'],
  ['YEARLY', '10/08/2026', '10/08/2027'],
  ['QUARTERLY', '07/09/2026', '06/12/2026'],
];
export const ROWS = SAMPLE.map(([period, certified, expiry], i) => ({ id: i, desc: DESC, type: TYPE, period, certified, expiry }));

export const COLS = [
  { key: 'desc', label: 'Certificate Description', sortable: false },
  { key: 'type', label: 'Certificate type', sortable: true },
  { key: 'period', label: 'Period', sortable: true },
  { key: 'certified', label: 'Certified date', sortable: true, date: true },
  { key: 'expiry', label: 'Expiry date', sortable: true, date: true },
];

function DateTimeField({ id, label, value, onChange, error }) {
  const picker = useRef(null);
  const open = () => {
    const p = picker.current;
    if (!p) return;
    p.value = toLocal(value);
    if (typeof p.showPicker === 'function') { try { p.showPicker(); return; } catch { /* fall through */ } }
    p.focus();
  };
  return (
    <Field className="pub-field" invalid={!!error}>
      <FieldLabel htmlFor={id}>{label} <span className="up-req" aria-hidden="true">*</span></FieldLabel>
      {error && <FieldError match>{error}</FieldError>}
      <div className="up-dt">
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" required inputMode="numeric"
          aria-describedby={`${id}-fmt`} aria-invalid={!!error || undefined} />
        <button type="button" className="up-cal" onClick={open} aria-label={`Choose ${label} from a calendar`}>
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
        </button>
        <input ref={picker} type="datetime-local" className="up-picker" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { const v = fromLocal(e.target.value); if (v) onChange(v); }} />
      </div>
      <span id={`${id}-fmt`} className="up-hint">DD/MM/YYYY HH:MM</span>
    </Field>
  );
}

export default function Uplift({ query = {} }) {
  const fresh = () => ({ loc: '', from: '', to: fmt(new Date()) });
  const [v, setV] = useState(() => ({ ...fresh(), ...Object.fromEntries(['loc', 'from', 'to'].filter((k) => query[k]).map((k) => [k, query[k]])) }));
  const [samples, setSamples] = useState(false);
  const formRef = useRef(null);
  const [errs, setErrs] = useState({});
  const [result, setResult] = useState(null);
  const [sort, setSort] = useState(null); // { key, dir: 1 | -1 }
  const [note, setNote] = useState('');
  const sumRef = useRef(null);
  const resRef = useRef(null);
  const today = useMemo(() => new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), []);

  useEffect(() => { document.title = 'Customer Enquiry and Verification of Certificate (uplift mock-up)'; }, []);
  // A demo link (?run=1) opens the page with the search already run.
  useEffect(() => { if (query.run === '1') formRef.current?.requestSubmit(); }, []); // eslint-disable-line

  const set = (k) => (val) => { setV((x) => ({ ...x, [k]: val })); setNote(''); };

  const search = (e) => {
    e.preventDefault();
    const x = {};
    if (!v.loc.trim()) x.loc = 'Location code is required.';
    else if (!/^\d+$/.test(v.loc.trim())) x.loc = 'Location code must be a number.';
    const f = parse(v.from); const t = parse(v.to);
    if (!v.from.trim()) x.from = 'Date/Time from is required.';
    else if (!f) x.from = 'Date/Time from must be DD/MM/YYYY HH:MM.';
    if (!v.to.trim()) x.to = 'Date/Time to is required.';
    else if (!t) x.to = 'Date/Time to must be DD/MM/YYYY HH:MM.';
    if (f && t && f > t) x.to = 'Date/Time to must be after Date/Time from.';
    setErrs(x); setNote('');
    if (Object.keys(x).length) { setResult(null); setTimeout(() => sumRef.current?.focus(), 0); return; }
    // A certificate is listed when it was in force at any time in the range.
    const rows = v.loc.trim() === '0000' ? [] : ROWS.filter((r) => parseDay(r.certified) <= t && parseDay(r.expiry) >= f);
    setResult({ rows, loc: v.loc.trim() }); setSort(null);
    setTimeout(() => resRef.current?.focus(), 0);
  };
  const clear = () => { setV(fresh()); setErrs({}); setResult(null); setSort(null); setNote(''); };
  const close = () => { clear(); setNote('CLOSE leaves the search and returns to the page that opened it. In this mock-up it starts a new search.'); };

  const rows = useMemo(() => {
    if (!result) return [];
    if (!sort) return result.rows;
    const col = COLS.find((c) => c.key === sort.key);
    const val = (r) => (col.date ? parseDay(r[sort.key]).getTime() : r[sort.key]);
    return [...result.rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : a.id - b.id) * sort.dir);
  }, [result, sort]);
  const toggle = (key) => setSort((s) => (s && s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  const problems = ['loc', 'from', 'to'].filter((k) => errs[k]).map((k) => ({ id: `up-${k}`, msg: errs[k] }));
  const closeBtn = <Button type="button" variant="outline" className="up-close" onClick={close}>CLOSE</Button>;

  return (
    <div className="pub up">
      <a className="skip" href="#up-main" onClick={(e) => { e.preventDefault(); document.getElementById('up-main')?.focus(); }}>Skip to content</a>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained">
        <HeaderBrand href="#/uplift" sitename="Customer Enquiry and Verification of Certificate" />
      </Header>
      <div className="up-bar">
        <div className="pub-wrap up-bar__in">
          <nav aria-label="Support" className="up-bar__nav"><a href="#/uplift">Contact us</a><a href="#/uplift">Help</a></nav>
          <span>{today}</span>
        </div>
      </div>
      <div className="up-flag"><div className="pub-wrap">Phase 1 uplift mock-up · same page, fields and results as today, new look only · sample data</div></div>

      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page up-page">
        <h1>Search</h1>
        <p className="up-lede">Please enter the search parameters</p>
        <p className="up-mand"><span className="up-req" aria-hidden="true">*</span> indicates mandatory fields.</p>

        <form ref={formRef} className="pub-form up-form" onSubmit={search} noValidate>
          {problems.length > 0 && (
            <div className="pub-errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="up-err-h">
              <h3 id="up-err-h">Please fix the following</h3>
              <ul>{problems.map((p) => <li key={p.id}><a href={`#${p.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(p.id)?.focus(); }}>{p.msg}</a></li>)}</ul>
            </div>
          )}
          <div className="up-grid">
            <Field className="pub-field up-loc" invalid={!!errs.loc}>
              <FieldLabel htmlFor="up-loc">Location code <span className="up-req" aria-hidden="true">*</span></FieldLabel>
              {errs.loc && <FieldError match>{errs.loc}</FieldError>}
              <div className="pn-wrap">
                <Input id="up-loc" value={v.loc} onChange={(e) => set('loc')(e.target.value)} inputMode="numeric" autoComplete="off" required aria-invalid={!!errs.loc || undefined} />
                <button type="button" className="pn-samples" onClick={() => setSamples(!samples)} aria-expanded={samples}>Samples ▾</button>
              </div>
              {samples && (
                <div className="snp-pop" role="listbox" aria-label="Sample searches">
                  <div className="snp-strip">PROTOTYPE · SAMPLE SEARCHES</div>
                  {UPLIFT_SAMPLES.map((s) => (
                    <button key={s.label} type="button" role="option" className="snp-item" onClick={() => { setV({ loc: s.loc, from: s.from, to: s.to }); setErrs({}); setSamples(false); }}>
                      <span className="snp-num">{s.loc}</span>
                      <span className="snp-meta"><strong>{s.label}</strong><br />{s.from} to {s.to} · {s.note}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <DateTimeField id="up-from" label="Date/Time from" value={v.from} onChange={set('from')} error={errs.from} />
            <DateTimeField id="up-to" label="Date/Time to" value={v.to} onChange={set('to')} error={errs.to} />
          </div>
          <div className="up-actions">
            <Button type="submit">SEARCH</Button>
            <Button type="button" variant="outline" onClick={clear}>CLEAR</Button>
            {!result && closeBtn}
          </div>
        </form>

        {note && <p role="status" className="up-note">{note}</p>}

        {result && (
          <section aria-labelledby="up-res-h" className="up-results">
            <h2 id="up-res-h" tabIndex={-1} ref={resRef}>Search results</h2>
            <p role="status" className="up-note">{result.rows.length} certificate{result.rows.length === 1 ? '' : 's'} for location code {result.loc}.</p>
            <div className="up-scroll">
              <table className="up-table">
                <thead>
                  <tr>
                    {COLS.map((c) => (
                      <th key={c.key} scope="col" aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                        {c.sortable ? (
                          <button type="button" className="up-sort" onClick={() => toggle(c.key)}>
                            {c.label}
                            <span aria-hidden="true" className="up-sort__ico">{sort?.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span>
                          </button>
                        ) : c.label}
                      </th>
                    ))}
                    <th scope="col"><span className="up-sr">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>{COLS.map((c) => <td key={c.key}>{r[c.key]}</td>)}<td><button type="button" className="up-view" onClick={() => go(`/uplift/record?loc=${encodeURIComponent(result.loc)}&id=${r.id}`)}>View<span className="up-sr"> certificate certified {r.certified}</span></button></td></tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={COLS.length + 1} className="up-empty">No records found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="up-actions up-actions--after">{closeBtn}</div>
          </section>
        )}

        <p className="up-foot">Mock-up: use Samples ▾ for ready-made searches, or any numeric location code (0000 shows the no-records case). Stories, open questions and the legacy comparison are in the <a href="#/demo/uplift-scenarios">demo hub</a>.</p>
      </main>
    </div>
  );
}
