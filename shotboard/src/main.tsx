import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/app.css'

// No <StrictMode>: its dev-only double mount makes drei's <Html> labels warn on every load.
createRoot(document.getElementById('root')!).render(<App />)
