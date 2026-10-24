// Small line icons for the teaching cards. Decorative: the card title carries the meaning.
const P = {
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></>,
  eye: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  sign: <><path d="M12 3v18M8 21h8" /><rect x="5" y="3" width="14" height="9" rx="1.5" /><path d="M8.5 7.5h7" /></>,
  person: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" /></>,
  light: <><rect x="8" y="2.5" width="8" height="19" rx="3" /><circle cx="12" cy="7" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="17" r="1.6" /></>,
  camera: <><path d="M3 8h4l1.5-2.5h7L17 8h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  route: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8 7c8 0 2 10 8 10" /></>,
  ruler: <><rect x="2.5" y="8" width="19" height="8" rx="1.5" /><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4" /></>,
  slow: <><path d="M4 16a8 8 0 0 1 16 0" /><path d="m12 16 4-5" /><circle cx="12" cy="16" r="1" /></>,
  view: <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  download: <><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M4 19h16" /></>,
  blur: <><circle cx="12" cy="8" r="3.5" strokeDasharray="2 2" /><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" strokeDasharray="2 2" /></>,
};
export default function Icon({ name }) {
  return <svg className="ms-ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>;
}
