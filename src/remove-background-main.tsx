import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { BackgroundRemoverApp } from './BackgroundRemoverApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackgroundRemoverApp />
  </StrictMode>,
)
