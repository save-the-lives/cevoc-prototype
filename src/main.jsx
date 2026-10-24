import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@nswds/ui/styles.css';
import './styles/base.css';
import './styles/gallery.css';
import './styles/public.css';
import './styles/staff.css';
import './styles/demo.css';
import './styles/workspace.css';

if (!window.location.hash) window.location.hash = '/demo';
createRoot(document.getElementById('root')).render(<App />);
