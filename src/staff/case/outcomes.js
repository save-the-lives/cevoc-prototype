// What a Revenue NSW officer can record in CEVOC. Revenue resolves what is within its own authority; it cannot withdraw
// enforcement on technical or certification grounds (that authority sits with Transport), so a referral is a separate
// request, not an outcome. Court-elected matters have no outcome here: prosecution and court steps happen outside CEVOC,
// and Revenue NSW notifies Transport to prepare the defence.
export const OUTCOMES = {
  review: [['answered', 'Resolved: customer’s enquiry answered'], ['checked', 'Resolved: certification and evidence checked, no technical concern']],
  court: [],
};
