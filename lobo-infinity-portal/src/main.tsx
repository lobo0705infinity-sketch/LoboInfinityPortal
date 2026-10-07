import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/rajdhani/latin-500.css'
import '@fontsource/rajdhani/latin-700.css'
import '@fontsource/bebas-neue/latin-400.css'
import './index.css'
import App from './App'
import { initializeDeploymentRecovery } from './services/deploymentRecovery'
import { initializePerformanceMonitoring } from './services/rumMetrics'

initializeDeploymentRecovery()
initializePerformanceMonitoring()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
