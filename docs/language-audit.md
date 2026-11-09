# Language Consistency Audit: CEVOC vs NSW Government Sites

Audited against [service.nsw.gov.au](https://service.nsw.gov.au), [revenue.nsw.gov.au](https://revenue.nsw.gov.au), and [nsw.gov.au/money-and-taxes/fines-and-fees](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image).

## Terminology Comparison

| Our term | Their term | Source | Source page | Recommendation |
|---|---|---|---|---|
| **Penalty notice number** | "Penalty notice number" / "fine notice number" | Revenue NSW / nsw.gov.au | myPenalty login form / [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ✅ Our "Penalty notice number" matches Revenue NSW. NSW.gov.au uses "fine notice number" — keep ours, since Revenue NSW is the issuing authority. |
| **Date of the offence** (form legend) | "date of the offence" | Revenue NSW / nsw.gov.au | myPenalty form / [Request a review](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/request-a-review) | ✅ Matches. |
| **Vehicle registration** (form label, as of fc0d80d) | "Vehicle Registration Number" / "registration plate number" / "number plate" | Revenue NSW / Service NSW / nsw.gov.au | myPenalty plate form / [Check a vehicle registration](https://service.nsw.gov.au/transaction/check-a-vehicle-registration) / [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ⚠️ Revenue NSW uses "Vehicle Registration Number". nsw.gov.au uses "number plate". Our "Vehicle registration" is close but not identical to either. **Consider "Vehicle registration number"** to match Revenue NSW exactly. |
| **Number plate of the vehicle** (Notice.jsx:101, PlateAsk) | see above | — | — | 🔴 **Outdated.** Still uses the old term. Must be renamed to match the main form ("Vehicle registration"). Also at Notice.jsx:93, 108, 122, 144, 145, 153. |
| **Number plate** (Notice.jsx:345, journey.js:68, DemoHub.jsx:48, LookupForm.jsx:87) | see above | — | — | 🔴 **Inconsistent.** Several places still say "number plate" while the main form now says "Vehicle registration". Update all. |
| **Registration number** (Notice.jsx:345, LiveCheck.jsx:45) | see above | — | — | ⚠️ A third variant. Consolidate to one term site-wide. |
| **Camera photos** / **camera images** | "camera image" / "digital image" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ⚠️ nsw.gov.au says "camera image" (singular/plural), never "camera photos". Our headings and loading text say "camera photos". **Consider "camera images"** for consistency. |
| **Check the evidence for a camera-detected offence** (hero heading) | "View a camera image of your offence" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ⚠️ nsw.gov.au uses "View a camera image". Our wording is more formal with "evidence" and "camera-detected". **Consider closer alignment** — e.g. "View the camera images for your offence" or keep "Check the evidence" if the broader scope (certificates + images) is intended. |
| **Camera certificates** (CertificateList heading) | Not used on nsw.gov.au fines pages | — | — | ⚠️ No direct equivalent found. The term "certificate" in the context of camera calibration/testing is specific to TfNSW's CEVOC system. Keep as is — this is domain terminology the public pages don't surface. |
| **Nominate the driver** (options step) | "Nominate someone else for a fine" | nsw.gov.au | [Request a review](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/request-a-review) | ⚠️ nsw.gov.au says "Nominate someone else for a fine". Our "Nominate the driver" is shorter but assumes it's about a driver. **Consider "Nominate someone else"** to match. |
| **Ask for a review** (options step) | "Request a review of your fine" / "Request a review" | nsw.gov.au | [Request a review](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/request-a-review) | ⚠️ nsw.gov.au uses "Request a review". Our "Ask for a review" is plainer English. Either works; "Request a review" is closer to official language. |
| **Pay** (options step) | "Pay your fine" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ✅ Close enough. Our CTA says "Pay or set up a plan" which adds useful detail. |
| **Have a court decide** (options step) | Not found as a standard heading | — | — | ⚠️ nsw.gov.au doesn't use this phrase. Legal Aid NSW uses "Request to have a penalty decided in court". **Consider "Take it to court"** or similar plain language. |
| **Road safety enforcement** (site header) | Not used on public sites | — | — | ⚠️ This is a TfNSW internal term. nsw.gov.au uses "Fines and fees" as the category. For a public-facing prototype, consider whether this signals correctly — it's technically accurate for the camera enforcement context. Keep for now; revisit if the service broadens. |
| **Show me what happened** (submit button) | "View the image now" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ⚠️ nsw.gov.au is more clinical. Our wording is plain-language and empathetic. Keep — it's intentional UX. |
| **(working prototype)** (footer) | No equivalent | Service NSW | service.nsw.gov.au | ✅ Service NSW has no copyright line. Our "(working prototype)" label is appropriate for the prototype stage. |
| **Person / Organisation** (IdentityAsk radio) | Not found on public fines pages | Revenue NSW | myPenalty identity page | ✅ Matches Revenue NSW's own `recipientTypeList` radio labels. |
| **Family name / Given names** (IdentityAsk fields) | "Last name" / "First name" | Revenue NSW | myPenalty identity page (field names: `lastName`, `firstName`) | ⚠️ Revenue NSW's form fields are named `lastName`/`firstName`. Our labels say "Family name"/"Given names". Both are acceptable in Australian government contexts; "Family name"/"Given names" is more inclusive. Keep — it's a deliberate UX choice. |
| **Mobile phone and seatbelt detection cameras** | "Mobile phone and seatbelt detection cameras" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ✅ Matches when used together. |
| **Red-light speed camera** | "Red-light speed camera" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ⚠️ nsw.gov.au says "Red-light speed camera" (hyphenated, combined). Check our program labels match this exactly. |
| **Fixed speed camera** | "Fixed speed camera" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ✅ Matches. |
| **Bus lane camera** | "Bus lane camera" | nsw.gov.au | [View camera image](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image) | ✅ Matches. |
| **Interim service** (DemoHub.jsx:110 footer) | — | — | — | 🔴 **Outdated.** Main app footer changed to "(working prototype)" but DemoHub still says "Interim service". Update. |

## Priority Actions

### 🔴 Must fix (inconsistencies within the site)
1. **Notice.jsx PlateAsk** (lines 93, 101, 108, 122, 144, 145, 153): Still says "number plate". Rename to "vehicle registration" to match the main form.
2. **journey.js** (line 68): "number plate" → "vehicle registration"
3. **Notice.jsx** (line 345): "registration number" → "vehicle registration"
4. **DemoHub.jsx** (line 48): "Number plate" → "Vehicle registration"
5. **DemoHub.jsx** (line 110): "Interim service" → "(working prototype)"
6. **LookupForm.jsx** (line 87): "number plate" → "vehicle registration"
7. **media.test.js** (line 42): "number plate" → "vehicle registration"
8. **journey.js** (line 122): "number plate" → "vehicle registration"

### ⚠️ Consider (alignment with NSW Gov language)
9. "camera photos" → "camera images" (matches nsw.gov.au)
10. "Nominate the driver" → "Nominate someone else" (matches nsw.gov.au)
11. "Ask for a review" → "Request a review" (matches nsw.gov.au)
12. "Vehicle registration" → "Vehicle registration number" (matches Revenue NSW exactly)
13. Hero heading alignment with nsw.gov.au's "View a camera image" phrasing

### ✅ Already correct
- Penalty notice number
- Date of the offence
- Person / Organisation (matches Revenue NSW)
- Family name / Given names (inclusive Australian gov style)
- Pay / Pay or set up a plan
- Fixed speed camera, Bus lane camera
- (working prototype) footer

Sources:
- [View a camera image of your offence — nsw.gov.au](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/view-camera-image)
- [Request a review of your fine — nsw.gov.au](https://www.nsw.gov.au/money-and-taxes/fines-and-fees/fines/request-a-review)
- [Check a vehicle registration — Service NSW](https://service.nsw.gov.au/transaction/check-a-vehicle-registration)
