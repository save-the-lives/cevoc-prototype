// Single place the UI talks to the backend. Swap the backend adapter, not this file.
export async function lookupPenalty({ infringementNumber, offenceDate }) {
  const res = await fetch('/api/penalty-lookups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ infringementNumber, offenceDate }),
  });
  if (res.status === 400) throw new Error('Please check the notice number and the offence date.');
  if (!res.ok) throw new Error('Something went wrong. Please try again.');
  return res.json();
}
