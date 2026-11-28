import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../shared/AppShell'
import { notify } from '../../shared/notify'
import JournalView from './JournalView'
import { OrdonnancesView, PreventifView, RdvView } from './MedViews'
import { ProfilView, UrgenceView } from './ProfilView'
import QuickSaisie from './QuickSaisie'
import {
  ALL_SUIVIS,
  bandeauAccueil,
  bienfaits,
  cooccurrences,
  cyclesOf,
  dayOf,
  dernieresValeurs,
  eventsOfType,
  eventsOnDay,
  fmtDay,
  fmtPct,
  isSuiviActive,
  labelOfEvent,
  makeEvent,
  phaseOfDay,
  prevision,
  seedConfig,
  seedRefs,
  sortEventsDesc,
  timeOf,
  todayDay,
  touchEvent,
  upsertRef,
  type Attachment,
  type ProfilSante,
  type RefItem,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs,
  type SuiviId
} from './logic'
import {
  deleteAttachment,
  deleteEvent,
  loadAttachments,
  loadConfig,
  loadEvents,
  loadProfil,
  loadRefs,
  saveAttachment,
  saveConfig,
  saveEvent,
  saveProfil,
  saveRefs
} from './store'

const LOGO = `${import.meta.env.BASE_URL}app-icons/salveto.svg`

type View = 'accueil' | 'journal' | 'traitements' | 'cycle' | 'rdv' | 'ordonnances' | 'preventif' | 'profil' | 'urgence'

const NAV: { label: string; icon: string; view?: View; soon?: boolean }[] = [
  { label: 'Accueil', icon: '🏠', view: 'accueil' },
  { label: 'Journal', icon: '📖', view: 'journal' },
  { label: 'Courbes', icon: '📈', soon: true },
  { label: 'Cycle', icon: '🌸', view: 'cycle' },
  { label: 'RDV', icon: '🗓️', view: 'rdv' },
  { label: 'Ordonnances', icon: '📄', view: 'ordonnances' },
  { label: 'Traitements', icon: '💊', view: 'traitements' },
  { label: 'Préventif', icon: '🩺', view: 'preventif' },
  { label: 'Profil santé', icon: '🧾', view: 'profil' },
  { label: 'Rapports', icon: '🗂️', soon: true },
  { label: 'Paramètres', icon: '⚙️', soon: true }
]

const QUICK_SUIVIS: SuiviId[] = [
  'moral',
  'energie',
  'poids',
  'crise',
  'sommeil',
  'symptome',
  'habitude',
  'note',
  'traitement',
  'constante',
  'cycle'
]

export default function SalvetoApp() {
  const [config, setConfig] = useState<SalvetoConfig | null>(null)
  const [events, setEvents] = useState<SalvetoEvent[]>([])
  const [refs, setRefs] = useState<SalvetoRefs>(seedRefs())
  const [profil, setProfil] = useState<ProfilSante | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [view, setView] = useState<View>('accueil')
  const [checked, setChecked] = useState<Set<SuiviId>>(() => new Set(ALL_SUIVIS.map((s) => s.id)))
  const [panel, setPanel] = useState<SuiviId | null>(null)
  const coocs = useMemo(() => cooccurrences(events), [events])

  useEffect(() => {
    void Promise.all([loadConfig(), loadEvents(), loadRefs(), loadProfil(), loadAttachments()]).then(
      ([c, evs, r, p, att]) => {
        setConfig(c)
        setEvents(sortEventsDesc(evs))
        setRefs(r)
        setProfil(p)
        setAttachments(att)
      }
    )
  }, [])

  if (!config) {
    return (
      <AppShell appId="salveto" appName="Salveto" logo={LOGO}>
        <div className="salveto-main" />
      </AppShell>
    )
  }

  if (!config.onboarded) {
    const toggle = (id: SuiviId): void => {
      const next = new Set(checked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setChecked(next)
    }
    const start = (): void => {
      const c: SalvetoConfig = {
        ...seedConfig(),
        onboarded: true,
        activeSuivis: ALL_SUIVIS.map((s) => s.id).filter((id) => checked.has(id))
      }
      saveConfig(c)
      setConfig(c)
    }
    return (
      <div className="salveto-onboarding">
        <div className="sa-onb-card">
          <img className="sa-onb-logo" src={LOGO} alt="" />
          <h1 className="sa-onb-title">Bienvenue dans Salveto</h1>
          <p className="sa-onb-text">
            Ton journal de suivi santé et humeur, 100 % local : rien ne quitte cet ordinateur. Choisis les suivis qui
            t’intéressent pour commencer léger — tu pourras les activer ou désactiver à tout moment dans les
            paramètres, sans jamais perdre tes données.
          </p>
          <div className="sa-onb-list" role="group" aria-label="Choisir les suivis à activer">
            {ALL_SUIVIS.map((s) => (
              <label key={s.id} className="sa-onb-item">
                <input
                  type="checkbox"
                  checked={checked.has(s.id)}
                  onChange={() => toggle(s.id)}
                  data-suivi={s.id}
                />
                <span className="sa-onb-icon" aria-hidden>
                  {s.icon}
                </span>
                <span>
                  <strong>{s.label}</strong>
                  <span className="sa-onb-desc"> — {s.desc}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" className="db-btn sa-onb-start" disabled={checked.size === 0} onClick={start}>
            C’est parti →
          </button>
        </div>
      </div>
    )
  }

  const quick = ALL_SUIVIS.filter((s) => QUICK_SUIVIS.includes(s.id) && config.activeSuivis.includes(s.id))
  const today = eventsOnDay(events, todayDay())
  const bien = bienfaits(events, refs)
  const traitementsRefs = refs.items.filter((r) => r.kind === 'traitement')
  const dernieres = dernieresValeurs(events, refs)
  const prisesParRef = new Map<string, number>()
  for (const e of eventsOfType(events, 'traitement')) {
    const k = e.refId ?? e.label ?? '?'
    prisesParRef.set(k, (prisesParRef.get(k) ?? 0) + 1)
  }
  const cycles = cyclesOf(events)
  const prev = prevision(cycles)
  const phaseAuj = isSuiviActive(config, 'cycle') ? phaseOfDay(cycles, todayDay()) : ''

  const onUpsertRef = (r: RefItem): void => {
    setRefs((prev) => {
      const next = upsertRef(prev, r)
      saveRefs(next)
      return next
    })
  }

  const onUpdateEvent = (e: SalvetoEvent): void => {
    const t = touchEvent(e)
    void saveEvent(t)
    setEvents((prev) => sortEventsDesc(prev.map((x) => (x.id === t.id ? t : x))))
    notify('Événement mis à jour')
  }

  const onSaveConfig = (c: SalvetoConfig): void => {
    saveConfig(c)
    setConfig(c)
  }

  const onDeleteEvent = (id: string): void => {
    void deleteEvent(id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    notify('Entrée supprimée')
  }

  const onSaveProfil = (p: ProfilSante): void => {
    saveProfil(p)
    setProfil(p)
    notify('Profil santé enregistré')
  }

  const onSaveAttachment = (a: Attachment): void => {
    void saveAttachment(a)
    setAttachments((prev) => [...prev.filter((x) => x.id !== a.id), a])
  }

  const onDeleteAttachment = (id: string): void => {
    void deleteAttachment(id)
    setAttachments((prev) => prev.filter((x) => x.id !== id))
    notify('Pièce jointe supprimée')
  }

  const onAttach = (id: string, refId: string, refType: 'rdv' | 'ordonnance' | 'profil'): void => {
    setAttachments((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, refId: refId || undefined, refType } : a))
      const a = next.find((x) => x.id === id)
      if (a) void saveAttachment(a)
      return next
    })
  }

  const bandeau = profil ? bandeauAccueil(events, refs, config, profil) : bandeauAccueil(events, refs, config)

  const onSaveEvent = (e: SalvetoEvent): void => {
    void saveEvent(e)
    setEvents((prev) => sortEventsDesc([...prev, e]))
    setPanel(null)
    notify(`${labelOfEvent(e)} — enregistré`)
  }

  return (
    <AppShell
      appId="salveto"
      appName="Salveto"
      logo={LOGO}
      sidebar={
        <div className="sa-side">
          <p className="sa-side-title">Salveto</p>
          {NAV.map((n) =>
            n.view ? (
              <button
                key={n.label}
                type="button"
                className={`sa-side-row${view === n.view ? ' active' : ''}`}
                data-nav={n.view}
                onClick={() => setView(n.view as View)}
              >
                <span aria-hidden>{n.icon}</span> {n.label}
              </button>
            ) : (
              <span key={n.label} className="sa-side-row soon" aria-disabled>
                <span aria-hidden>{n.icon}</span> {n.label} <em>bientôt</em>
              </span>
            )
          )}
        </div>
      }
    >
      <div className="salveto-main">
        {view === 'journal' ? (
          <JournalView events={events} onUpdateEvent={onUpdateEvent} onDeleteEvent={onDeleteEvent} />
        ) : view === 'profil' && profil ? (
          <ProfilView
            profil={profil}
            events={events}
            attachments={attachments}
            onSaveProfil={onSaveProfil}
            onSaveAttachment={onSaveAttachment}
            onDeleteAttachment={onDeleteAttachment}
            onAttach={onAttach}
          />
        ) : view === 'urgence' && profil ? (
          <UrgenceView profil={profil} />
        ) : view === 'rdv' ? (
          <RdvView
            events={events}
            refs={refs}
            config={config}
            onSaveEvent={onSaveEvent}
            onUpdateEvent={onUpdateEvent}
            onUpsertRef={onUpsertRef}
            onSaveConfig={onSaveConfig}
          />
        ) : view === 'ordonnances' ? (
          <OrdonnancesView
            events={events}
            refs={refs}
            config={config}
            onSaveEvent={onSaveEvent}
            onUpdateEvent={onUpdateEvent}
            onUpsertRef={onUpsertRef}
            onSaveConfig={onSaveConfig}
          />
        ) : view === 'preventif' ? (
          <PreventifView
            events={events}
            refs={refs}
            config={config}
            onSaveEvent={onSaveEvent}
            onUpdateEvent={onUpdateEvent}
            onUpsertRef={onUpsertRef}
            onSaveConfig={onSaveConfig}
          />
        ) : view === 'cycle' ? (
          <>
            <h1 className="sa-h1">Cycle menstruel</h1>
            {cycles.length === 0 ? (
              <p className="sa-empty">Aucune période enregistrée — saisis-en une depuis l’accueil (« + Cycle »).</p>
            ) : (
              <>
                <section>
                  <h2 className="sa-h2">Prévision (indicative, calcul 100 % local)</h2>
                  {prev.moyCycle && prev.prochaineRegles ? (
                    <>
                      <p>
                        Prochaine période estimée : <strong>{fmtDay(prev.prochaineRegles)}</strong> (moyenne de{' '}
                        {prev.baseCycles} cycle{prev.baseCycles > 1 ? 's' : ''} : {prev.moyCycle} j)
                      </p>
                      <p>
                        Fenêtre ovulatoire indicative :{' '}
                        <strong>
                          {fmtDay(prev.fenetreDebut!)} → {fmtDay(prev.fenetreFin!)}
                        </strong>{' '}
                        (ovulation estimée le {fmtDay(prev.ovulation!)})
                      </p>
                    </>
                  ) : (
                    <p>Enregistre au moins 2 cycles pour obtenir une prévision (moyenne des durées observées).</p>
                  )}
                  <p className="sa-cooc-note">
                    Prévisions purement indicatives — aucun calcul médical, aucune donnée envoyée hors de cet
                    appareil.
                  </p>
                  <p className="sa-muted">
                    Moyennes observées : cycle {prev.moyCycle ?? '—'} j · règles {prev.moyRegles ?? '—'} j ·{' '}
                    {cycles.length} période{cycles.length > 1 ? 's' : ''} enregistrée{cycles.length > 1 ? 's' : ''}
                  </p>
                </section>
                <section>
                  <h2 className="sa-h2">Historique par cycle</h2>
                  <ul className="sa-cooc-list">
                    {[...cycles].reverse().map((c) => (
                      <li key={c.eventId} className="sa-cycle-row">
                        Du <strong>{fmtDay(c.debut)}</strong>
                        {c.fin ? (
                          <>
                            {' '}
                            au <strong>{fmtDay(c.fin)}</strong>
                          </>
                        ) : (
                          ''
                        )}{' '}
                        — {c.dureeRegles} j de règles
                        {c.dureeCycle ? `, cycle de ${c.dureeCycle} j` : ''}
                        {c.flux ? ` · flux ${c.flux}` : ''}
                        {c.notes ? ` · ${c.notes}` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        ) : view === 'traitements' ? (
          <>
            <h1 className="sa-h1">Traitements & activités suivis</h1>
            <section className="sa-bien">
              <h2 className="sa-h2">Ce qui me fait du bien</h2>
              <p className="sa-cooc-note">
                D’après tes seules notes d’effet ressenti — aucune recommandation, aucune alerte de prise.
              </p>
              {bien.length === 0 ? (
                <p className="sa-empty">Aucune prise notée pour l’instant.</p>
              ) : (
                <ul className="sa-cooc-list">
                  {bien.map((b) => (
                    <li key={b.refId} className="sa-bien-row" data-ref={b.refId}>
                      <strong>{b.label}</strong> — score {b.score >= 0 ? `+${b.score}` : b.score} · {b.prises} prise
                      {b.prises > 1 ? 's' : ''}{' '}
                      <span className="sa-muted">
                        (
                        {Object.entries(b.effetCounts)
                          .filter(([, n]) => n > 0)
                          .map(([e, n]) => `${e} × ${n}`)
                          .join(' · ') || 'aucun effet noté'}
                        )
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="sa-h2">Traitements suivis ({traitementsRefs.length})</h2>
              {traitementsRefs.length === 0 ? (
                <p className="sa-empty">Aucun traitement suivi — saisis-en un depuis l’accueil (« + Traitement »).</p>
              ) : (
                <ul className="sa-cooc-list">
                  {traitementsRefs.map((t) => (
                    <li key={t.id}>
                      <strong>{t.label}</strong> — {prisesParRef.get(t.id) ?? 0} prise(s) notée(s)
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <h2 className="sa-h2">Constantes définies ({dernieres.length})</h2>
              {dernieres.length === 0 ? (
                <p className="sa-empty">Aucune constante — saisis-en une depuis l’accueil (« + Constante »).</p>
              ) : (
                <ul className="sa-cooc-list">
                  {dernieres.map((d) => (
                    <li key={d.refId}>
                      <strong>{d.label}</strong>
                      {d.unite ? ` (${d.unite})` : ''} —{' '}
                      {d.value != null
                        ? `dernière valeur ${d.value}${d.unite ? ` ${d.unite}` : ''} le ${d.date ? dayOf(d.date) : ''}`
                        : 'aucune valeur saisie'}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <>
        <h1 className="sa-h1">Accueil</h1>
        <button type="button" className="sa-urgence-btn" onClick={() => setView('urgence')}>
          🚨 Carte d’urgence (1 clic)
        </button>
        {bandeau.length > 0 && (
          <div className="sa-bandeau" role="status">
            <p className="sa-bandeau-title">Rappels passifs (uniquement à l’ouverture de l’app) :</p>
            <ul className="sa-bandeau-list">
              {bandeau.map((b, i) => (
                <li key={i} className={`sa-bandeau-item sa-bandeau-${b.kind}`}>
                  {b.texte}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="sa-muted">Saisie rapide — {quick.length} suivis actifs.</p>
        <div className="sa-quick">
          {quick.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`sa-quick-btn${s.id === 'crise' ? ' sa-quick-crise' : ''}${panel === s.id ? ' active' : ''}`}
              data-quick={s.id}
              onClick={() => setPanel(panel === s.id ? null : s.id)}
            >
              {s.icon} + {s.label}
            </button>
          ))}
        </div>
        {panel && (
          <QuickSaisie suivi={panel} refs={refs} onSave={onSaveEvent} onUpsertRef={onUpsertRef} onClose={() => setPanel(null)} />
        )}
        <h2 className="sa-h2">Aujourd’hui ({today.length})</h2>
        {today.length === 0 ? (
          <p className="sa-empty">Aucune saisie aujourd’hui pour l’instant.</p>
        ) : (
          <ul className="sa-day-list">
            {today.map((e) => (
              <li key={e.id} className="sa-day-row" data-event={e.id} data-type={e.type}>
                <span className="sa-day-time">{timeOf(e.date)}</span>
                <span>{labelOfEvent(e)}</span>
                {phaseAuj && <span className="sa-day-phase">{phaseAuj}</span>}
              </li>
            ))}
          </ul>
        )}
        {isSuiviActive(config, 'crise') && coocs.length > 0 && (
          <section className="sa-cooc">
            <h2 className="sa-h2">Co-occurrences observées avec les crises</h2>
            <p className="sa-cooc-note">
              Observation statistique uniquement — Salveto n’interprète jamais médicalement.
            </p>
            <ul className="sa-cooc-list">
              {coocs.slice(0, 6).map((c) => (
                <li key={c.trigger}>
                  <strong>« {c.trigger} »</strong> — {c.crises} crise{c.crises > 1 ? 's' : ''} sur {c.total} (
                  {fmtPct(c.ratio)})
                </li>
              ))}
            </ul>
          </section>
        )}
          </>
        )}
      </div>
    </AppShell>
  )
}

// makeEvent réexporté pour les futurs écrans (journal, édition)
export { makeEvent }
