import { useId } from 'react';

// A link out to another agency's system. It looks and behaves like any other button, so the prototype reads as the real service.
// On hover or keyboard focus a small amber note explains that the action happens outside CEVOC. Presenters can also
// switch "highlight hand-offs" on in the demo hub to see every one at once.
export default function Handoff({ to = 'Revenue NSW', what, notice, children }) {
  const id = useId();
  return (
    <span className="ho" data-ho>
      <span className="ho__ctl" aria-describedby={id}>{children}</span>
      <span className="ho__tag" aria-hidden="true">↗ {to}</span>
      <span className="ho__note" role="tooltip" id={id}>
        <b>Outside this prototype</b>
        <span>{what} happens on <strong>{to}’s</strong> system. In the real service this opens {to}{notice ? ` with notice ${notice} already filled in` : ''}.</span>
      </span>
    </span>
  );
}
