import './demo.css';

/**
 * The 'Demo data' tag at the right-hand end of the NSW Government header. It takes no row of its own, so the demo pages keep the
 * real page's layout. Real text (not colour alone) with an accessible name that says what it means.
 */
export default function DemoTag() {
  return (
    <span className="demo-tag-head" role="note" data-testid="demo-tag" aria-label="Demo data: this page shows sample information">
      <span aria-hidden="true">Demo data</span>
    </span>
  );
}
