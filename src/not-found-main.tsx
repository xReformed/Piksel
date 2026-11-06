import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import { NotFoundApp } from './NotFoundApp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotFoundApp />
  </StrictMode>,
)
