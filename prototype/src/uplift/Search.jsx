import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Callout, Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem,
  ComboboxList, ComboboxValue, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle, Header, HeaderBrand, Masthead,
  useComboboxAnchor,
} from '@nswds/ui';
import { go } from '../lib/router.js';
import DateRange from './DateRange.jsx';
import { CERTIFICATES, FAULT_CODES, LOCATIONS, SAMPLES, fmtDay, locByCode, locLabel, parseDay, searchCertificates } from './data.js';
import { useLabels } from './kit.jsx';
import TourLayer, { useTour } from './Tour.jsx';

// PHASE 1 UPLIFT (#/uplift): the legacy certificate search for power users (Revenue NSW staff), no login.
// Several locations by code or address, a day range with one calendar, results that expand in place,
// and three distinct outcomes when there is nothing to list: no match, a genuinely missing certificate, a fault.
// Nothing prototype-specific sits on the page: samples, labels, notes, stories and questions are in the Tour overlay.

const ITEMS = LOCATIONS.map(locLabel);
const codeOf = (label) => label.split(' · ')[0];
const COLS = ['location', 'desc', 'type', 'period', 'certified', 'expiry'];
const SORTABLE = new Set(['location', 'type', 'period', 'certified', 'expiry']);
const DATE = new Set(['certified', 'expiry']);

const TOUR_SAMPLES = (setV, run) => (
  <section>
    <h3>Sample searches</h3>
    <ul className="tr-list">{SAMPLES.map((s) => (
      <li key={s.label}><button type="button" className="tr-link" onClick={() => {
        const vals = { locs: s.locs.map(locByCode).map(locLabel), from: s.from, to: s.to };
        setV(vals); run(vals);
      }}>{s.label}</button> <small>{s.note}</small></li>
    ))}</ul>
  </section>
);

export function SupportBar() {
  const today = useMemo(() => new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), []);
  return (
    <div className="up-bar"><div className="pub-wrap up-bar__in">
      <nav aria-label="Support" className="up-bar__nav" data-tour="support"><a href="#/uplift">Contact us</a><a href="#/uplift">Help</a></nav>
      <span>{today}</span>
    </div></div>
  );
}

export function Details({ r }) {
  const { on: tour } = useTour();
  const replaced = r.reissueOf && CERTIFICATES.find((x) => x.id === r.reissueOf);
  return (
    <dl className="uh-dl">
      <dt>Location</dt><dd>{locByCode(r.loc)?.address} ({r.loc})</dd>
      <dt>Status</dt><dd>{r.status}{r.withdrawn ? `, withdrawn ${r.withdrawn}` : ''}</dd>
      {replaced && <><dt>Re-issue of</dt><dd>{replaced.period} certificate {replaced.certified} to {replaced.expiry}, withdrawn {replaced.withdrawn}</dd></>}
      {tour && ['Device model', 'Gazette reference', 'Approved for', 'Inspection date and time', 'Inspection details'].map((k) => (
        <Fragment key={k}><dt className="tr-ghost">{k}</dt><dd className="tr-ghost">BRD BR_01 field, awaiting CMCS sample data (U3)</dd></Fragment>
      ))}
    </dl>
  );
}

export default function Search({ query = {} }) {
  const { L, mode } = useLabels();
  const init = () => ({ locs: (query.locs || '').split(',').map(locByCode).filter(Boolean).map(locLabel), from: query.from || '', to: query.to || '' });
  const [v, setV] = useState(init);
  const [errs, setErrs] = useState({});
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [sort, setSort] = useState(null);
    const anchor = useComboboxAnchor();
  const sumRef = useRef(null);
  const resRef = useRef(null);

  useEffect(() => { document.title = 'Certificate search (uplift prototype)'; }, []);

  const run = (vals = v) => {
    const x = {};
    if (!vals.locs.length) x.locs = `Add at least one ${mode === 'legacy' ? 'location code' : 'camera location'}.`;
    const f = parseDay(vals.from); const t = parseDay(vals.to);
    if (!vals.from.trim()) x.from = `Enter the ${L.from} date.`; else if (!f) x.from = `${L.from} must be a real date in dd/mm/yyyy format.`;
    if (!vals.to.trim()) x.to = `Enter the ${L.to} date.`; else if (!t) x.to = `${L.to} must be a real date in dd/mm/yyyy format.`;
    if (f && t && t < f) x.to = `${L.to} must be the same as or after ${L.from}.`;
    setErrs(x); setOpen(new Set()); setSort(null);
    if (Object.keys(x).length) { setRes(null); setTimeout(() => sumRef.current?.focus(), 0); return; }
    const codes = vals.locs.map(codeOf);
    if (codes.some((cd) => FAULT_CODES.has(cd))) setRes({ fault: true, codes, f, t });
    else setRes({ ...searchCertificates(codes, f, t), codes, f, t });
    setTimeout(() => resRef.current?.focus(), 0);
  };
  useEffect(() => { if (query.run === '1') run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { setV({ locs: [], from: '', to: '' }); setErrs({}); setRes(null); setOpen(new Set()); };
  const rows = useMemo(() => {
    if (!res?.rows) return [];
    const base = res.rows.map((r) => ({ ...r, location: r.loc }));
    if (!sort) return base;
    const val = (r) => (DATE.has(sort.k) ? parseDay(r[sort.k]).getTime() : r[sort.k]);
    return [...base].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [res, sort]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const problems = [['locs', 'uh-loc'], ['from', 'dr-from'], ['to', 'dr-to']].filter(([k]) => errs[k]);
  const searched = res && `${res.codes.join(', ')}, ${fmtDay(res.f)} to ${fmtDay(res.t)}`;

  return (
    <div className="pub up uh">
      <a className="skip" href="#up-main" onClick={(e) => { e.preventDefault(); document.getElementById('up-main')?.focus(); }}>Skip to content</a>
      <div role="region" aria-label="NSW Government"><Masthead container="contained" /></div>
      <Header color="white" border container="contained"><HeaderBrand href="#/uplift" sitename="Customer Enquiry and Verification of Certificate" /></Header>
      <SupportBar />

      <main id="up-main" tabIndex={-1} className="pub-wrap pub-page up-page">
        <div data-tour="title"><h1>{L.h1}</h1>
        <p className="up-lede">{L.intro}</p></div>
        <p className="up-mand">{mode === 'legacy' && <span className="up-req" aria-hidden="true">* </span>}{L.mandatory}</p>

        <form className="uh-form" noValidate onSubmit={(e) => { e.preventDefault(); run(); }}>
          {problems.length > 0 && (
            <div className="pub-errsum" role="alert" tabIndex={-1} ref={sumRef} aria-labelledby="uh-err-h">
              <h3 id="uh-err-h">There is a problem</h3>
              <ul>{problems.map(([k, id]) => <li key={k}><a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.focus(); }}>{errs[k]}</a></li>)}</ul>
            </div>
          )}
          <div className={`uh-field${errs.locs ? ' is-bad' : ''}`} data-tour="loc">
            <label htmlFor="uh-loc">{L.loc} <span className="up-req" aria-hidden="true">*</span></label>
            <span className="dr-hint" id="uh-loc-hint">Type a location code or part of an address, then pick it. Add as many as you need.</span>
            {errs.locs && <span className="dr-err">{errs.locs}</span>}
            <Combobox items={ITEMS} multiple value={v.locs} onValueChange={(locs) => setV((x) => ({ ...x, locs }))}>
              <ComboboxChips ref={anchor} className="uh-chips">
                <ComboboxValue>
                  {(vals) => vals.map((item) => <ComboboxChip key={item} removeLabel={`Remove ${item}`}>{item}</ComboboxChip>)}
                </ComboboxValue>
                <ComboboxChipsInput id="uh-loc" aria-describedby="uh-loc-hint" placeholder={v.locs.length ? 'Add another' : 'e.g. 1234 or Example St'} />
              </ComboboxChips>
              <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>No camera location matches. Check the code or try part of the street name.</ComboboxEmpty>
                <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="uh-dates" data-tour="dates">
            <DateRange labels={L} from={v.from} to={v.to} errors={errs} onChange={({ from, to }) => setV((x) => ({ ...x, from, to }))} />
          </div>
          <div className="uh-actions" data-tour="actions">
            <Button type="submit">{L.search}</Button>
            <Button type="button" variant="outline" onClick={clear}>{L.clear}</Button>
            {!res && <Button type="button" variant="outline" onClick={() => { clear(); go('/uplift/hub'); }}>{L.close}</Button>}
          </div>
        </form>

        {res && (
          <section aria-labelledby="uh-res-h" className="uh-results" data-tour="results">
            <h2 id="uh-res-h" tabIndex={-1} ref={resRef}>{L.results}</h2>

            <div data-tour="outcomes" className="uh-outcomes">
            {res.fault && (
              <Callout status="danger" title="We couldn’t get certificates right now" role="alert">
                <p>This is a problem with our system, not a missing certificate. Nothing has been checked yet. Try again in a few minutes; if it keeps happening, report it to the service desk.</p>
                <p className="uh-meta">Searched: {searched}.</p>
                <Button type="button" variant="outline" onClick={() => run()}>Try again</Button>
              </Callout>
            )}

            {!res.fault && res.gaps.length > 0 && (
              <Callout status="warning" title={`Missing certificate${res.gaps.length > 1 ? 's' : ''}: no certificate was in force on some days`}>
                <ul className="uh-gaps">{res.gaps.map((g) => <li key={`${g.code}${g.cycle}${g.from}`}>Location {g.code}: no {g.cycle.toLowerCase()} certificate from {fmtDay(g.from)} to {fmtDay(g.to)}.</li>)}</ul>
                <p className="uh-meta">This is a genuine gap in the records, not a search or system problem.</p>
              </Callout>
            )}

            {!res.fault && rows.length === 0 && (
              <Empty className="uh-empty">
                <EmptyHeader>
                  <EmptyTitle><h3>{mode === 'legacy' ? L.none : 'No certificates found'}</h3></EmptyTitle>
                  <EmptyDescription>Nothing was in force for {searched}. Check the locations and dates, or widen the range.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button type="button" variant="outline" onClick={() => document.getElementById('dr-from')?.focus()}>Change the dates</Button>
                </EmptyContent>
              </Empty>
            )}

            </div>
            {!res.fault && rows.length > 0 && (
              <>
                <p role="status" className="up-note">{rows.length} certificate{rows.length === 1 ? '' : 's'} for {searched}. Select a row to see its details.</p>
                <div className="up-scroll">
                  <table className="up-table uh-table">
                    <thead><tr>
                      <th scope="col"><span className="up-sr">Expand</span></th>
                      {COLS.map((k) => (
                        <th key={k} scope="col" aria-sort={sort?.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                          {SORTABLE.has(k) ? (
                            <button type="button" className="up-sort" onClick={() => setSort((s) => (s?.k === k ? { k, dir: -s.dir } : { k, dir: 1 }))}>
                              {L[k]}<span aria-hidden="true" className="up-sort__ico">{sort?.k === k ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}</span>
                            </button>
                          ) : L[k]}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const isOpen = open.has(r.id);
                        return (
                          <Fragment key={r.id}>
                            <tr className={`uh-row${isOpen ? ' is-open' : ''}${r.status === 'Withdrawn' ? ' is-withdrawn' : ''}`} onClick={() => toggle(r.id)}>
                              <td>
                                <button type="button" className="uh-exp" aria-expanded={isOpen} aria-controls={`uh-d-${r.id}`} onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>
                                  <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span><span className="up-sr">{isOpen ? 'Hide' : 'Show'} details for the {r.period.toLowerCase()} certificate certified {r.certified}, location {r.loc}</span>
                                </button>
                              </td>
                              <td>{r.loc}</td>
                              <td>{r.desc}{r.status === 'Withdrawn' && <span className="uh-tag is-warn">Withdrawn</span>}{r.reissueOf && <span className="uh-tag">Re-issued</span>}{r.duplicates > 0 && <span className="uh-tag is-open" title="The source holds identical copies of this certificate">Duplicate in source ×{r.duplicates + 1}</span>}</td>
                              <td>{r.type}</td><td>{r.period}</td><td>{r.certified}</td><td>{r.expiry}</td>
                            </tr>
                            {isOpen && <tr className="uh-detail" id={`uh-d-${r.id}`}><td /><td colSpan={COLS.length}><Details r={r} /></td></tr>}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="uh-actions uh-actions--after"><Button type="button" variant="outline" onClick={() => { clear(); go('/uplift/hub'); }}>{L.close}</Button></div>
          </section>
        )}
      </main>
      <TourLayer screen="search" controls={TOUR_SAMPLES(setV, run)} />
    </div>
  );
}
