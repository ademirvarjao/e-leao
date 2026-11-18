import {createRoot} from 'react-dom/client';import './styles.css';import App from './App';import {WorkspaceProvider} from './lib/workspace';
try{for(const c of ['large','contrast'])document.documentElement.classList.toggle(c,localStorage.getItem('eleao-'+c)==='true')}catch{/* No storage available. */}
createRoot(document.getElementById('root')!).render(<WorkspaceProvider><App/></WorkspaceProvider>);
