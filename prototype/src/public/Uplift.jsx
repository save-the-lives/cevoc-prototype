import { useEffect, useRef, useState } from 'react';
import { Button, Field, FieldDescription, FieldError, FieldLabel, Header, HeaderBrand, Input, Masthead, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nswds/ui';

// PHASE 1 UPLIFT MOCK-UP (#/uplift): the legacy certificate search page, lifted and shifted.
// Same fields, labels, buttons, columns and messages as the legacy page; only the look changes.
// No new functions: no PDF download, no links in the results. Sample data only.

const FORMAT = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/;

// Fictitious rows in the legacy results shape. Period is "from - to".
const ROWS = [
  { desc: 'Sample camera certificate A', type: 'Camera', from: '01/01/2026 00:00', to: '30/06/2026 23:59', certified: '02/01/2026', expiry: '30/06/2027' },
  { desc: 'Sample camera certificate B', type: 'Camera', from: '01/07/2025 00:00', to: '31/12/2025 23:59', certified: '02/07/2025', expiry: '31/12/2026' },
  { desc: 'Sample speed certificate C', type: 'Speed', from: '10/03/2026 08:00', to: '20/03/2026 06:00', certified: '10/03/2026', expiry: '10/03/2027' },
  { desc: 'Sample speed certificate D', type: 'Speed', from: '25/03/2026 00:00', to: '25/03/2026 23:59', certified: '24/03/2026', expiry: '24/03/2027' },
];

const toTime = (s) => {
  const m = FORMAT.exec(s.trim());
  if (!m) return null;
  const [, d, mo, y, h, mi] = m.map(Number);
  const t = new Date(y, mo - 1, d, h, mi);
  return t.getDate() === d && t.getMonth() === mo - 1 ? t.getTime() : null;
};

const EMPTY = { loc: '', from: '', to: '' };

export default function Uplift() {
  const [v, setV] = useState(EMPTY);
  const [errs, setErrs] = useState({});
  const [result, setResult] = useState(null);
  const [closed, setClosed] = useState(false);
  const sumRef = useRef(null);

  useEffect(() => { document.title = 'Customer Enquiry and Verification of Certificate (uplift mock-up)'; }, []);

  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); setClosed(false); };

  const search = (e) => {
    e.preventDefault();
    const x = {};
    if (!v.loc.trim()) x.loc = 'Location code is required.';
    const f = toTime(v.from); const t = toTime(v.to);
    if (!v.from.trim()) x.from = 'Date/Time from is required.';
    else if (f === null) x.from = 'Date/Time from must be DD/MM/YYYY HH:MM.';
    if (!v.to.trim()) x.to = 'Date/Time to is required.';
    else if (t === null) x.to = 'Date/Time to must be DD/MM/YYYY HH:MM.';
    if (!x.from && !x.to && f > t) x.to = 'Date/Time to must be after Date/Time from.';
    setErrs(x);
    if (Object.keys(x).length) { setResult(null); setTimeout(() => sumRef.current?.focus(), 0); return; }
    const rows = v.loc.trim() === '0000' ? [] : ROWS.filter((r) => toTime(r.from) <= t && toTime(r.to) >= f);
    setResult({ rows, loc: v.loc.trim(), from: v.from.trim(), to: v.to.trim() });
  };
  const clear = () => { setV(EMPTY); setErrs({}); setResult(null); setClosed(false); };
  const close = () => { clear(); setClosed(true); };

  const problems = ['loc', 'from', 'to'].filter((k) => errs[k]).map((k) => ({ id: `up-${k}`, msg: errs[k] }));

  const field = (k, label, extra = {}) => (
    <Field className="pub-field" invalid={!!errs[k]}>
      <FieldLabel htmlFor={`up-${k}`}>{label} *</FieldLabel>
      {extra.hint && <FieldDescription id={`up-${k}-hint`}>{extra.hint}</FieldDescription>}
      {errs[k] && <FieldError match>{errs[k]}</FieldError>}
      <Input id={`up-${k}`} value={v[k]} onChange={set(k)} autoComplete="off" required
        aria-describedby={extra.hint ? `up-${k}-hint` : undefined} aria-invalid={!!errs[k] || undefined}
        />
    </Field>
  );

  return (
    <div className="pub up">
      <a className="skip" href="#up-main" onClick={(e) => { e.preventDefault(); document.getElementById('up-main')?.focus(); }}>Skip to content</a>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained">
        <HeaderBrand href="#/uplift" sitename="Customer Enquiry and Verification of Certificate" />
      </Header>
      <div className="up-flag pub-wrap">Phase 1 uplift mock-up · same page and fields as today, new look only · sample data</div>
      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page">
        <h1>Search certificates</h1>
        <p className="pub-lede">Enter the camera location code and the date and time range. Fields marked * are required.</p>
        <form className="pub-form up-form" onSubmit={search} noValidate>
          {problems.length > 0 && (
            <div className="pub-errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="up-err-h">
              <h3 id="up-err-h">Please fix the following</h3>
              <ul>{problems.map((p) => <li key={p.id}><a href={`#${p.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(p.id)?.focus(); }}>{p.msg}</a></li>)}</ul>
            </div>
          )}
          <div className="up-grid">
            {field('loc', 'Location code')}
            {field('from', 'Date/Time from', { hint: 'DD/MM/YYYY HH:MM, for example 14/03/2026 08:30' })}
            {field('to', 'Date/Time to', { hint: 'DD/MM/YYYY HH:MM, for example 14/03/2026 08:30' })}
          </div>
          <div className="up-actions">
            <Button type="submit">SEARCH</Button>
            <Button type="button" variant="outline" onClick={clear}>CLEAR</Button>
            <Button type="button" variant="outline" onClick={close}>CLOSE</Button>
          </div>
        </form>

        {closed && <p role="status" className="up-note">CLOSE returns to the page that opened the search. In this mock-up it just clears the form.</p>}

        {result && (
          <section aria-labelledby="up-res-h" className="up-results">
            <h2 id="up-res-h">Results</h2>
            <p role="status" className="up-note">{result.rows.length} certificate{result.rows.length === 1 ? '' : 's'} for location {result.loc}, {result.from} to {result.to}.</p>
            <div className="up-scroll">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate Description</TableHead>
                    <TableHead>Certificate type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Certified date</TableHead>
                    <TableHead>Expiry date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((r) => (
                    <TableRow key={r.desc}>
                      <TableCell>{r.desc}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.from} - {r.to}</TableCell>
                      <TableCell>{r.certified}</TableCell>
                      <TableCell>{r.expiry}</TableCell>
                    </TableRow>
                  ))}
                  {result.rows.length === 0 && <TableRow><TableCell colSpan={5} className="up-empty">No records found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        <p className="up-foot">Try any location code with 01/03/2026 00:00 to 31/03/2026 23:59. Location code 0000 shows the no-records case.</p>
      </main>
    </div>
  );
}
