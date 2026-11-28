import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { applyTheme, getAccent, getTheme } from './shared/ThemeButton'
import './fonts.css'
import './styles/01-base.css'
import './styles/02-launcher.css'
import './styles/03-shell.css'

applyTheme(getTheme(), getAccent())

const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null
const onSystemTheme = () => applyTheme(getTheme(), getAccent())
if (mq) {
  if (mq.addEventListener) mq.addEventListener('change', onSystemTheme)
  else mq.addListener(onSystemTheme)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)

requestAnimationFrame(() => document.getElementById('boot')?.remove())
