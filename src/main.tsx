import { createRoot } from 'react-dom/client'
import './styles/01-base.css'

document.getElementById('boot')?.remove()

createRoot(document.getElementById('root')!).render(
  <main className="boot">
    <h1>
      Skouar<span className="dot">.</span>
    </h1>
    <p>Nouveau départ — la suite est reconstruite à partir d'un cahier des charges global.</p>
  </main>
)
