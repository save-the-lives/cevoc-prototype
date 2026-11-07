import { pickMessage } from './programs.js';

/**
 * A quiet informative callout below the program details, showing a single road-safety message
 * when one matches the notice's details. Highest-priority rule wins; null means nothing to say.
 * Controlled by the `messages` switch in the program/default types config.
 */
export default function RoadSafetyMessage({ result }) {
  const msg = pickMessage(result);
  if (!msg) return null;
  return (
    <aside className="road-safety-msg" aria-label="Road safety information">
      <p>{msg.text}</p>
    </aside>
  );
}
