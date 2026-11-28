import AppShell from '../../shared/AppShell'

export default function FichoramaApp(): JSX.Element {
  return (
    <AppShell
      appId="fichorama"
      appName="Fichorama"
      logo={`${import.meta.env.BASE_URL}app-icons/fichorama.svg`}
    >
      <div className="fichorama-main">
        <h1 className="fichorama-title">Fichorama</h1>
        <p className="fichorama-empty">Fiches de notation personnalisables — en construction.</p>
      </div>
    </AppShell>
  )
}
