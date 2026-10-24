import { Component } from 'react';
import { StoreProvider } from './lib/store.jsx';
import { useRoute } from './lib/router.js';
import { DemoDock } from './shared/ui.jsx';
import PublicSite from './public/Public.jsx';
import StaffSite from './staff/Staff.jsx';
import Demo from './demo/Demo.jsx';

// Three areas, never mixed: /demo (presenter), /staff (officers), everything else is public.

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui' }}>
        <h1>Something went wrong on this page</h1>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 12 }}>{String(this.state.err.stack || this.state.err)}</pre>
        <a href="#/demo" onClick={() => this.setState({ err: null })}>Back to the demo hub</a>
      </div>
    );
  }
}

function Routes() {
  const { raw, parts, query } = useRoute();
  let body;
  if (parts[0] === 'demo') body = <Demo section={parts[1]} />;
  else if (parts[0] === 'staff') body = <><StaffSite parts={parts} query={query} /><DemoDock /></>;
  else body = <><PublicSite parts={parts} /><DemoDock /></>;
  return <Boundary key={raw}>{body}</Boundary>;
}

export default function App() {
  return <StoreProvider><Routes /></StoreProvider>;
}
