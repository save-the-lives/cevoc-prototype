import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button, Callout, Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxItem,
  ComboboxList, ComboboxValue, Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle, Header, HeaderBrand, Masthead,
  useComboboxAnchor,
} from '@nswds/ui';
import { go } from '../lib/router.js';
import DateRange from './DateRange.jsx';
import { APP_SETTINGS, CERTIFICATES, FAULT_CODES, lifecycle, LOCATIONS, SAMPLES, fmtDay, locByCode, locLabel, parseDay, searchCertificates, typeOf } from './data.js';
import { Dyn, useLabels } from './kit.jsx';
import TourLayer, { useTour } from './Tour.jsx';

// PHASE 1 UPLIFT (#/uplift): the legacy certificate search for power users (Revenue NSW staff), no login.
// Several locations by code or address, a day range with one calendar, results that expand in place,
// and three distinct outcomes when there is nothing to list: no match, a genuinely missing certificate, a fault.
// Nothing prototype-specific sits on the page: samples, labels, notes, stories and questions are in the Tour overlay.

const ITEMS = LOCATIONS.map(locLabel);
const CHIP_LIMIT = 6; // chips shown before “+N more” (display only; there is no limit on how many can be picked, U25)
// Default range: the last search.defaultRangeMonths months (app setting, U10).
// Date presets (U27, owner): each sets From; To is always today, Sydney time. Both are app settings.
const PRESETS = APP_SETTINGS.find((x) => x.key === 'search.datePresets').value.split(', ');
const DEFAULT_PRESET = APP_SETTINGS.find((x) => x.key === 'search.defaultPreset').value;
const sydneyToday = () => parseDay(new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric' }));
const presetRange = (name) => {
  const t = sydneyToday(); const m = /Last (\d+) (days|months)/.exec(name);
  const n = Number(m[1]);
  const f = m[2] === 'days' ? new Date(t.getFullYear(), t.getMonth(), t.getDate() - (n - 1)) : new Date(t.getFullYear(), t.getMonth() - n, t.getDate());
  return { from: fmtDay(f), to: fmtDay(t) };
};
const DEFAULT_RANGE = () => presetRange(DEFAULT_PRESET);
const codeOf = (label) => label.split(' · ')[0];
const COLS = ['location', 'desc', 'type', 'period', 'certified', 'expiry'];
const SORTABLE = new Set(['location', 'type', 'period', 'certified', 'expiry']);
const DATE = new Set(['certified', 'expiry']);

const TOUR_SAMPLES = (setV, run, t) => (
  <>
  <section>
    <h3>Content</h3>
    <label className="tr-check"><input type="checkbox" checked={t.dyn} onChange={(e) => t.set({ dyn: e.target.checked })} /> Highlight dynamic data</label>
    <p className="tr-meta">Outlines every value that comes from CMCS, the search entered or today's date, with its source.</p>
  </section>
  <section>
    <h3>Sample searches</h3>
    <ul className="tr-list">{SAMPLES.map((s) => (
      <li key={s.label}><button type="button" className="tr-link" onClick={() => {
        const vals = { locs: s.locs.map(locByCode).map(locLabel), from: s.from, to: s.to };
        setV(vals); run(vals);
      }}>{s.label}</button> <small>{s.note}</small></li>
    ))}</ul>
  </section>
  </>
);

// Lifecycle status tag (U22): text and colour together, never colour alone.
export function StatusTag({ r }) {
  const s = lifecycle(r);
  return <span className={`st-tag is-${s.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{s}{s === 'Withdrawn' && r.withdrawn ? ` ${r.withdrawn}` : ''}</span>;
}

export function SupportBar() {
  const today = useMemo(() => new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), []);
  return (
    <div className="up-bar"><div className="pub-wrap up-bar__in">
      <nav aria-label="Support" className="up-bar__nav" data-tour="support"><a href="#/uplift">Contact us</a><a href="#/uplift">Help</a></nav>
      <span><Dyn src="Today's date (Sydney)">{today}</Dyn></span>
    </div></div>
  );
}

export function Details({ r }) {
  const { on: tour } = useTour();
  const replaced = r.reissueOf && CERTIFICATES.find((x) => x.id === r.reissueOf);
  return (
    <dl className="uh-dl">
      <dt>Location</dt><dd><Dyn src="CMCS site record">{locByCode(r.loc)?.address} ({r.loc})</Dyn></dd>
      <dt>Certificate type</dt><dd><Dyn src="CMCS: certificate type (names from app setting certificate.typesPerProgram)">{typeOf(locByCode(r.loc)?.program, r.kind).label}</Dyn></dd>
      <dt>Status</dt><dd><Dyn src="CMCS: certificate status">{r.status}{r.withdrawn ? `, withdrawn ${r.withdrawn}` : ''}</Dyn></dd>
      {replaced && <><dt>Re-issue of</dt><dd><Dyn src="CMCS: replaced certificate">{replaced.period} certificate {replaced.certified} to {replaced.expiry}, withdrawn {replaced.withdrawn}</Dyn></dd></>}
      {tour && ['Device model', 'Gazette reference', 'Approved for', 'Inspection date and time', 'Inspection details'].map((k) => (
        <Fragment key={k}><dt className="tr-ghost">{k}</dt><dd className="tr-ghost">BRD BR_01 field, awaiting CMCS sample data (U3)</dd></Fragment>
      ))}
    </dl>
  );
}

export default function Search({ query = {} }) {
  const { L, mode } = useLabels();
  const tour = useTour();
  const init = () => ({ locs: (query.locs || '').split(',').map(locByCode).filter(Boolean).map(locLabel), from: query.from || DEFAULT_RANGE().from, to: query.to || DEFAULT_RANGE().to });
  const [v, setV] = useState(init);
  const [errs, setErrs] = useState({});
  const [res, setRes] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const [sort, setSort] = useState(null);
  const [allChips, setAllChips] = useState(false);
  const [preset, setPreset] = useState(query.from || query.to ? 'Custom' : DEFAULT_PRESET);
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

  const clear = () => { setPreset(DEFAULT_PRESET); setV({ locs: [], ...DEFAULT_RANGE() }); setErrs({}); setRes(null); setOpen(new Set()); };
  const rows = useMemo(() => {
    if (!res?.rows) return [];
    const base = res.rows.map((r) => ({ ...r, location: r.loc }));
    // Grouped by location (U25): location order first, then the chosen sort within each location.
    const order = (r) => res.codes.indexOf(r.loc);
    const val = (r) => (!sort ? 0 : DATE.has(sort.k) ? parseDay(r[sort.k]).getTime() : r[sort.k]);
    return [...base].sort((a, b) => (sort?.k === 'location' ? 0 : order(a) - order(b)) || (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sort?.dir || 1));
  }, [res, sort]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const problems = [['locs', 'uh-loc'], ['from', 'dr-from'], ['to', 'dr-to']].filter(([k]) => errs[k]);
  const searched = res && <Dyn src="The search entered">{`${res.codes.join(', ')}, ${fmtDay(res.f)} to ${fmtDay(res.t)}`}</Dyn>;

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
            <Combobox items={ITEMS} multiple value={v.locs} onValueChange={(locs, d) => { if (d?.reason !== 'escape-key') setV((x) => ({ ...x, locs })); }}>
              <ComboboxChips ref={anchor} className="uh-chips">
                <ComboboxValue>
                  {(vals) => (
                    <>
                      {(allChips ? vals : vals.slice(0, CHIP_LIMIT)).map((item) => <ComboboxChip key={item} removeLabel={`Remove ${item}`}>{item}</ComboboxChip>)}
                      {vals.length > CHIP_LIMIT && <button type="button" className="uh-more" aria-expanded={allChips} onClick={(e) => { e.stopPropagation(); setAllChips(!allChips); }}>{allChips ? 'Show fewer' : `+${vals.length - CHIP_LIMIT} more`}</button>}
                    </>
                  )}
                </ComboboxValue>
                <ComboboxChipsInput id="uh-loc" aria-describedby="uh-loc-hint" placeholder={v.locs.length ? 'Add another' : 'e.g. 1234 or Example St'} />
              </ComboboxChips>
              <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>No camera location matches. Check the code or try part of the street name.</ComboboxEmpty>
                <ComboboxList>{(item) => <ComboboxItem key={item} value={item}>{item}</ComboboxItem>}</ComboboxList>
              </ComboboxContent>
            </Combobox>
            {v.locs.length > 1 && <button type="button" className="uh-clearall" onClick={() => setV((x) => ({ ...x, locs: [] }))}>Clear all locations ({v.locs.length})</button>}
          </div>
          <div className="uh-dates" data-tour="dates">
            <fieldset className="uh-presets">
              <legend>Date range</legend>
              {[...PRESETS, 'Custom'].map((p) => (
                <label key={p} className={preset === p ? 'on' : ''}>
                  <input type="radio" name="uh-preset" value={p} checked={preset === p} onChange={() => { setPreset(p); if (p !== 'Custom') setV((x) => ({ ...x, ...presetRange(p) })); else document.getElementById('dr-from')?.focus(); }} />
                  {p}
                </label>
              ))}
            </fieldset>
            <DateRange calendar={false} labels={L} from={v.from} to={v.to} errors={errs} onChange={({ from, to }) => { setPreset('Custom'); setV((x) => ({ ...x, from, to })); }} />
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
                <ul className="uh-gaps">{res.gaps.map((g) => <li key={`${g.code}${g.kind}${g.from}`}>Location <Dyn src="CMCS site record">{g.code}</Dyn>: no <Dyn src="CMCS: missing certificate type and cycle">{`${g.cycle ? `${g.cycle.toLowerCase()} ` : ''}${g.label.toLowerCase()}`}</Dyn> certificate from <Dyn src="CMCS: gap start">{fmtDay(g.from)}</Dyn> to <Dyn src="CMCS: gap end">{fmtDay(g.to)}</Dyn>.</li>)}</ul>
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
                <p role="status" className="up-note"><Dyn src="CMCS: count of results">{rows.length}</Dyn> certificate{rows.length === 1 ? '' : 's'} for {searched}. Select a row to see its details.</p>
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
                      {rows.map((r, idx) => {
                        const isOpen = open.has(r.id);
                        const newGroup = res.codes.length > 1 && (idx === 0 || rows[idx - 1].loc !== r.loc);
                        return (
                          <Fragment key={r.id}>
                            {newGroup && <tr className="uh-group"><th scope="rowgroup" colSpan={COLS.length + 1}><Dyn src="CMCS site record">{locByCode(r.loc)?.address}</Dyn> <span className="uh-group__code"><Dyn src="CMCS site record">{r.loc}</Dyn> · <Dyn src="CMCS: count of results">{rows.filter((x) => x.loc === r.loc).length}</Dyn> certificate{rows.filter((x) => x.loc === r.loc).length === 1 ? '' : 's'}</span></th></tr>}
                            <tr className={`uh-row${isOpen ? ' is-open' : ''}${r.status === 'Withdrawn' ? ' is-withdrawn' : ''}`} onClick={() => toggle(r.id)}>
                              <td>
                                <button type="button" className="uh-exp" aria-expanded={isOpen} aria-controls={`uh-d-${r.id}`} onClick={(e) => { e.stopPropagation(); toggle(r.id); }}>
                                  <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span><span className="up-sr">{isOpen ? 'Hide' : 'Show'} details for the {r.period.toLowerCase()} certificate certified {r.certified}, location {r.loc}</span>
                                </button>
                              </td>
                              <td><Dyn src="CMCS site record">{r.loc}</Dyn></td>
                              <td><Dyn src="CMCS: certificate description">{r.desc}</Dyn><Dyn src="CMCS: certificate status today"><StatusTag r={r} /></Dyn>{r.duplicates > 0 && <Dyn src="CMCS: duplicate rows"><span className="st-tag is-error" title="The source holds identical copies of this certificate">Data error: duplicate ×{r.duplicates + 1}</span></Dyn>}</td>
                              <td><Dyn src="CMCS: certificate type">{r.type}</Dyn></td><td><Dyn src="CMCS: period">{r.period}</Dyn></td><td><Dyn src="CMCS: certified date">{r.certified}</Dyn></td><td><Dyn src="CMCS: expiry date">{r.expiry}</Dyn></td>
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
      <TourLayer screen="search" controls={TOUR_SAMPLES(setV, run, tour)} />
    </div>
  );
}
