// Architecture decision records for the uplift (owner, 25 Nov 2026). Replaces the earlier "Decisions" page (AD-1 is
// now ADR-001). Each record: Title, Status (Proposed / Accepted / Superseded), Context, Options, Decision,
// Consequences and links to the questions and stories it touches. All are Proposed until confirmed.

export const ADR_STATUS = ['Proposed', 'Accepted', 'Superseded'];

export const ADRS = [
  {
    id: 'ADR-001',
    title: 'Where the rules for each camera program live',
    status: 'Proposed',
    context: 'Each enforcement program (red light speed, fixed speed, average speed, mobile phone detection, and any added later) may need different certificate types, cycles and wording. The design must scale when a new program is added, without reworking the page each time. Several front ends will show the same certificates: this page, the later Transport facelift, and possibly Service NSW and Revenue NSW.',
    options: [
      { name: 'A. Program rules as app settings read by the page', how: 'Per program, app settings list which certificate types apply and show, on what cycle, and which wins when several are in force; another app setting turns each program on or off. The React page reads them and applies the rules itself.', pros: ['Visible and editable without a release', 'Simple backend'], cons: ['Rule logic is repeated in every front end that shows certificates', 'Each front end must change for a new kind of rule', 'Easy for the page and the API to disagree'] },
      { name: 'B. Decoupled: the API decides, the page only displays', how: 'The Java backend holds the per-program rules (as its own app settings) and returns, for a site and date range or a signed link, exactly what to show: certificates in force, which one counts, labels and the program’s template. The page has no program knowledge.', pros: ['One source of truth for every front end', 'Adding a program needs no page change', 'Rules are tested once, in the backend'], cons: ['API responses are richer (ready to display)', 'Rule changes need access to the backend’s app settings'] },
    ],
    decision: 'Proposed: B. The rules are app settings held and applied by the backend, which returns results ready to display; an app setting per program turns it on or off.',
    consequences: 'A new program is added in the backend’s app settings and every front end picks it up. Only a genuinely new kind of rule needs backend code, in one place. The API contract must carry labels and the template to use.',
    qs: ['U16', 'U5', 'U36', 'U7', 'U37'], stories: ['S8', 'S16', 'S21'],
  },
  {
    id: 'ADR-002',
    title: 'App settings served to the page through a read-only /config',
    status: 'Proposed',
    context: 'Many values must change without a release: date presets, the default range, the location limit, visible statuses, return links, Contact us and Help links, copy templates. They need one owner and one place, and the page must not hard-code them.',
    options: [
      { name: 'A. Built into the page at release time', how: 'Values sit in the page’s code or build settings.', pros: ['No extra call'], cons: ['Every change needs a release', 'Other front ends can’t share them'] },
      { name: 'B. Backend store, read-only /config loaded at start-up', how: 'The backend keeps every app setting with its owner; the page fetches /config once when it loads and uses the values it gets.', pros: ['Change without a release', 'Same values for every front end', 'Each setting has a named owner'], cons: ['The page needs safe defaults if /config fails'] },
    ],
    decision: 'Proposed: B. Every configurable value is an app setting (configurable), listed on the App settings tab, held by the backend and served read-only through /config.',
    consequences: 'The page ships sensible defaults and logs when /config can’t be read. Changing a setting needs backend settings access and an owner’s approval, not a page release.',
    qs: ['U10', 'U11', 'U35', 'U9'], stories: ['S2', 'S19', 'S20', 'S22'],
  },
  {
    id: 'ADR-003',
    title: 'Signed link and source code, without federated login',
    status: 'Proposed',
    context: 'People reach the certificate page from the Service NSW app and the Revenue NSW fine sites. Phase 1 has no login (U14). The page must show only the certificates for that offence, and send people back to where they came from.',
    options: [
      { name: 'A. Federated login from Service NSW', how: 'The person signs in and the page asks Service NSW who they are and which offences they have.', pros: ['Strong identity'], cons: ['Large new integration', 'Revenue NSW sites would need the same', 'Out of scope for a lift and shift'] },
      { name: 'B. Signed link with a source code', how: 'The calling site builds a link with the offence’s location, date and time, a source code (SNSW or RNSW) and a signature over all of them. The page checks the signature; a changed value counts as tampered.', pros: ['No login needed', 'The source code picks the return link', 'Works for every calling site'], cons: ['Keys must be shared and rotated', 'A link can be shared on by the person'] },
    ],
    decision: 'Proposed: B. A signed link carrying the source code; no federated login in phase 1.',
    consequences: 'Each calling site needs a signing key and the agreed parameter list (U29, U30). A wrong or changed link shows a plain message, never another person’s data.',
    qs: ['U32', 'U14', 'U15', 'U29', 'U30', 'U31', 'U6'], stories: ['S11', 'S14', 'S22'],
  },
  {
    id: 'ADR-004',
    title: 'Show certificates by lifecycle status, not after fixed delays',
    status: 'Proposed',
    context: 'The legacy page hides new certificates for a set number of days. CMCS knows each certificate’s status (approved, published, withdrawn, re-issued), which says more reliably whether it should be seen.',
    options: [
      { name: 'A. Fixed delays', how: 'A certificate appears a set number of days after it is issued.', pros: ['Simple; matches today'], cons: ['Shows certificates that were later withdrawn', 'Delays are guesses'] },
      { name: 'B. Lifecycle status', how: 'Which statuses are visible is an app setting (default: approved and published); withdrawn and re-issued certificates show for what they are.', pros: ['Accurate', 'Explains withdrawn and re-issued certificates plainly'], cons: ['Needs the status from CMCS on every certificate'] },
    ],
    decision: 'Proposed: B. Visibility follows the lifecycle status; the visible statuses are an app setting.',
    consequences: 'CMCS must send the status with each certificate. The Lifecycle tab shows how each status looks on both screens.',
    qs: ['U2', 'U22', 'U23', 'U24'], stories: ['S9', 'S12', 'S15'],
  },
  {
    id: 'ADR-005',
    title: 'How long a signed certificate link stays valid',
    status: 'Proposed',
    context: 'The Service NSW app and myPenalty open the record page with a signed link: p (notice number), d (offence date and time), s (site), i, r (source) and m (signature). There is no login. For one notice the link is the same every time it is made and never expires, so a link that is forwarded, screenshotted, left in browser history on a shared computer, or written to a proxy log keeps working for good. What a leaked link shows is limited: notice number, offence date and time, camera site and offence, no name or number plate, and the certificate information itself is public through the search. The risk is low, but it is not nothing, and today the only way to turn off a leaked link is to change the signing key for everyone.',
    options: [
      { name: 'A. Never expires (legacy)', how: 'Keep today’s behaviour: a correctly signed link works forever.', pros: ['No change for Service NSW or Revenue NSW', 'Pure lift and shift'], cons: ['A leaked link works for good', 'No way to turn off one link; changing the key breaks every link at once'] },
      { name: 'B. Expires a set time after the offence (d)', how: 'CEVOC refuses links whose offence date is older than an app setting, for example 12 months.', pros: ['No change for the apps'], cons: ['Still a long window for a leaked link', 'Blocks people who need the certificate late, for example for a court date'] },
      { name: 'C. Short life from when the link is made', how: 'The apps add t, the time they made the link, and a key version k, both inside the signature. CEVOC accepts the link for a set time after t (app setting, proposed 24 hours, with a few minutes’ allowance for clock differences). The apps already make the link when the person taps, so a fresh one is made every time.', pros: ['A leaked link stops working within a day', 'The person never notices: tapping again makes a new link', 'A leaked key can be retired by version without breaking new links'], cons: ['Service NSW and Revenue NSW must add t and k to their link builders', 'Needs an expired-link message (S14)'] },
    ],
    decision: 'Proposed: C, phased. Phase 1 (lift and shift): accept legacy links without t as today (app setting link.requireIssuedAt = off), so nothing breaks, and add the baseline controls below. Once both apps send t and k, turn the app setting on so links last 24 hours. Baseline controls in every phase: HTTPS only; Referrer-Policy no-referrer so the link is not passed on to other sites; Cache-Control no-store; noindex so search engines never list a record; server logs keep the path but drop or mask the signature and notice number; repeated wrong signatures from one address are slowed; the signing key is kept in a secrets store, rotated each year and at once if it leaks.',
    consequences: 'An expired link shows a plain message: “This link has expired. Open it again from the Service NSW app or myPenalty”, with the return link for its source (S22). The validity period, the legacy switch, the clock allowance and the accepted key versions are app settings. Cyber to confirm the 24-hour default; Service NSW and Revenue NSW to confirm when they can add t and k.',
    qs: ['U38', 'U15', 'U29', 'U30', 'U9', 'U14'], stories: ['S11', 'S14', 'S22'],
  },
];
