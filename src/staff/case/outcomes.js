// What a Revenue NSW officer can decide on a case, by case type. Asking Transport for technical advice is not an
// outcome: it is a separate request that leaves the case open (see lib/workflow.js).
export const OUTCOMES = {
  review: [['uphold', 'Uphold the fine'], ['withdraw', 'Withdraw the fine'], ['caution', 'Withdraw and give a caution']],
  court: [['brief', 'Prepare brief of evidence'], ['withdraw', 'Withdraw the fine']],
};
