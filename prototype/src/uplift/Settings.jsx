import { Link } from '../shared/ui.jsx';
import { APP_SETTINGS } from './data.js';

// Hub page: every app setting (configurable) the uplift relies on (owner, 25 Nov 2026).
export default function Settings() {
  return (
    <>
      <div className="uh-card ct-req">
        <p><strong>How app settings work:</strong> the backend holds them (for example Azure App Configuration or a settings table) and serves a read-only <code>/config</code> endpoint. The React front end loads it once at startup and caches it. Changing a setting needs no redeploy of either side. Anything tunable in the stories and questions is an app setting.</p>
      </div>
      <div className="up-scroll">
        <table className="uh-tbl">
          <thead><tr><th>Key</th><th>Purpose</th><th>Default in the prototype</th><th>Owner</th><th>Question</th></tr></thead>
          <tbody>{APP_SETTINGS.map((s) => (
            <tr key={s.key}><td><code>{s.key}</code></td><td>{s.purpose}</td><td>{s.value}</td><td>{s.owner}</td><td><Link to={`/uplift/hub/questions?q=${s.q}`}>{s.q}</Link></td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
