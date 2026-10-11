import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './04_ui-interface/GameUI'
import './04_ui-interface/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('앱을 마운트할 #root 요소가 index.html에 없습니다.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
