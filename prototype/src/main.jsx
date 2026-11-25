import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/public-sans/latin-700.css';
import '@fontsource/public-sans/latin-800.css';
import '@nswds/ui/styles.css';
import './styles/base.css';
import './styles/gallery.css';
import './styles/public.css';
import './styles/staff.css';
import './styles/demo.css';
import './styles/workspace.css';

if (!window.location.hash) window.location.hash = '/demo';
createRoot(document.getElementById('root')).render(<App />);
