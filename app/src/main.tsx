import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import '@fontsource/nunito/900.css'
import '@fontsource/gentium-plus/400.css'
import '@fontsource/gentium-plus/700.css'
import './index.css'
import App from './App.tsx'
import { browserStorage, createStore } from './lib/storage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={createStore(browserStorage())} />
  </StrictMode>,
)
