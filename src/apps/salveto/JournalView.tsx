import { useMemo, useState } from 'react'
import {
  EFFETS,
  EVENT_TYPES,
  EVENT_TYPE_ICONS,
  EVENT_TYPE_LABELS,
  MOIS,
  dayMarkers,
  dayOf,
  eventsOnDay,
  fmtDay,
  labelOfEvent,
  monthGrid,
  searchEvents,
  sortEventsDesc,
  timeOf,
  todayDay,
  type Effet,
  type EventType,
  type SalvetoEvent
} from './logic'

interface Props {
  events: SalvetoEvent[]
  onUpdateEvent: (e: SalvetoEvent) => void
  onDeleteEvent: (id: string) => void
}

function EditModal({ e, onClose, onSave }: { e: SalvetoEvent; onClose: () => void; onSave: (e: SalvetoEvent) => void }) {
  const [date, setDate] = useState(e.date.slice(0, 16))
  const [value, setValue] = useState(e.value != null ? String(e.value) : '')
  const [label, setLabel] = useState(e.label ?? '')
  const [notes, setNotes] = useState(e.notes ?? '')
  const [fin, setFin] = useState(e.fin ? e.fin.slice(0, 10) : '')
  const [flux, setFlux] = useState(e.flux ?? '')
  const [effet, setEffet] = useState(e.effet ?? '')
  const [zones, setZones] = useState((e.zones ?? []).join(', '))
  const [decl, setDecl] = useState((e.declencheurs ?? []).join(', '))
  const [coucher, setCoucher] = useState(e.heureCoucher ?? '')
  const [reveil, setReveil] = useState(e.heureReveil ?? '')
  const [duree, setDuree] = useState(e.dureeMin != null ? String(e.dureeMin) : '')
  const [medecin, setMedecin] = useState(e.medecin ?? '')
  const [contenu, setContenu] = useState(e.contenu ?? '')
  const [renouveler, setRenouveler] = useState(!!e.aRenouveler)
  const [lieu, setLieu] = useState(e.lieu ?? '')
  const [motif, setMotif] = useState(e.motif ?? '')

  const hasValue = ['moral', 'energie', 'poids', 'crise', 'sommeil', 'symptome', 'constante'].includes(e.type)

  const save = (): void => {
    const split = (s: string): string[] | undefined => {
      const arr = s.split(',').map((x) => x.trim()).filter(Boolean)
      return arr.length ? arr : undefined
    }
    onSave({
      ...e,
      date: /T\d{2}:\d{2}/.test(date) ? `${date}:00` : e.date,
      value: hasValue && value.trim() !== '' ? Number(value) : undefined,
      label: label.trim() || undefined,
      notes: notes.trim() || undefined,
      fin: fin ? `${fin}T23:00:00` : undefined,
      flux: flux.trim() || undefined,
      effet: (effet || undefined) as Effet | undefined,
      zones: split(zones),
      declencheurs: split(decl),
      heureCoucher: coucher || undefined,
      heureReveil: reveil || undefined,
      dureeMin: duree.trim() !== '' ? Number(duree) : undefined,
      medecin: medecin.trim() || undefined,
      contenu: contenu.trim() || undefined,
      aRenouveler: renouveler || undefined,
      lieu: lieu.trim() || undefined,
      motif: motif.trim() || undefined
    })
  }

  return (
    <div className="sa-modal" role="dialog" aria-label="Modifier l’entrée">
      <div className="sa-modal-card">
        <h2 className="sa-h2">
          Modifier — {EVENT_TYPE_ICONS[e.type]} {EVENT_TYPE_LABELS[e.type]}
        </h2>
        <label className="sa-field">
          Date / heure
          <input className="db-input" type="datetime-local" value={date} onChange={(ev) => setDate(ev.target.value)} />
        </label>
        {hasValue && (
          <label className="sa-field">
            Valeur
            <input className="db-input sa-poids-input" type="number" step="any" value={value} onChange={(ev) => setValue(ev.target.value)} />
          </label>
        )}
        {e.type !== 'note' && (
          <label className="sa-field">
            Libellé
            <input className="db-input" type="text" value={label} onChange={(ev) => setLabel(ev.target.value)} />
          </label>
        )}
        {e.type === 'crise' && (
          <>
            <label className="sa-field">
              Zones (séparées par des virgules)
              <input className="db-input" type="text" value={zones} onChange={(ev) => setZones(ev.target.value)} />
            </label>
            <label className="sa-field">
              Déclencheurs (séparés par des virgules)
              <input className="db-input" type="text" value={decl} onChange={(ev) => setDecl(ev.target.value)} />
            </label>
          </>
        )}
        {e.type === 'sommeil' && (
          <div className="sa-panel-row">
            <label className="sa-field">
              Couché
              <input className="db-input" type="time" value={coucher} onChange={(ev) => setCoucher(ev.target.value)} />
            </label>
            <label className="sa-field">
              Réveil
              <input className="db-input" type="time" value={reveil} onChange={(ev) => setReveil(ev.target.value)} />
            </label>
          </div>
        )}
        {e.type === 'symptome' && (
          <label className="sa-field">
            Durée (min)
            <input className="db-input sa-poids-input" type="number" value={duree} onChange={(ev) => setDuree(ev.target.value)} />
          </label>
        )}
        {e.type === 'cycle' && (
          <div className="sa-panel-row">
            <label className="sa-field">
              Fin
              <input className="db-input" type="date" value={fin} onChange={(ev) => setFin(ev.target.value)} />
            </label>
            <label className="sa-field">
              Flux
              <input className="db-input" type="text" value={flux} onChange={(ev) => setFlux(ev.target.value)} />
            </label>
          </div>
        )}
        {e.type === 'traitement' && (
          <label className="sa-field">
            Effet ressenti
            <select className="db-select" value={effet} onChange={(ev) => setEffet(ev.target.value)}>
              <option value="">—</option>
              {EFFETS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        )}
        {e.type === 'ordonnance' && (
          <>
            <label className="sa-field">
              Médecin
              <input className="db-input" type="text" value={medecin} onChange={(ev) => setMedecin(ev.target.value)} />
            </label>
            <label className="sa-field">
              Contenu
              <textarea className="db-input sa-note-input" rows={2} value={contenu} onChange={(ev) => setContenu(ev.target.value)} />
            </label>
            <label className="sa-field sa-check">
              <input type="checkbox" checked={renouveler} onChange={(ev) => setRenouveler(ev.target.checked)} /> À renouveler
            </label>
            <label className="sa-field">
              Date de fin
              <input className="db-input" type="date" value={fin} onChange={(ev) => setFin(ev.target.value)} />
            </label>
          </>
        )}
        {e.type === 'rdv' && (
          <div className="sa-panel-row">
            <input className="db-input" type="text" placeholder="Lieu" value={lieu} onChange={(ev) => setLieu(ev.target.value)} />
            <input className="db-input" type="text" placeholder="Motif" value={motif} onChange={(ev) => setMotif(ev.target.value)} />
          </div>
        )}
        <label className="sa-field">
          Notes
          <textarea className="db-input sa-note-input" rows={3} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        </label>
        <div className="sa-panel-row">
          <button type="button" className="db-btn sa-panel-save" onClick={save}>
            Enregistrer
          </button>
          <button type="button" className="sa-panel-close" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

export default function JournalView({ events, onUpdateEvent, onDeleteEvent }: Props) {
  const [filtre, setFiltre] = useState<'all' | EventType>('all')
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<'timeline' | 'calendrier'>('timeline')
  const [editing, setEditing] = useState<SalvetoEvent | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const today = todayDay()
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [calDay, setCalDay] = useState<string | null>(today)

  const filtered = useMemo(() => {
    const byType = filtre === 'all' ? events : events.filter((e) => e.type === filtre)
    return sortEventsDesc(searchEvents(byType, q))
  }, [events, filtre, q])

  const byDay = useMemo(() => {
    const m = new Map<string, SalvetoEvent[]>()
    for (const e of filtered) {
      const d = dayOf(e.date)
      m.set(d, [...(m.get(d) ?? []), e])
    }
    return m
  }, [filtered])

  const dayLabel = (d: string): string => {
    if (d === today) return "Aujourd’hui"
    if (d === todayDayOffset(-1)) return 'Hier'
    return fmtDay(d)
  }

  const row = (e: SalvetoEvent): JSX.Element => (
    <li key={e.id} className="sa-day-row sa-journal-row" data-event={e.id}>
      <span className="sa-day-time">{timeOf(e.date)}</span>
      <span className="sa-journal-icon" aria-hidden>
        {EVENT_TYPE_ICONS[e.type]}
      </span>
      <span className="sa-journal-label">{labelOfEvent(e)}</span>
      <span className="sa-journal-actions">
        <button type="button" className="sa-link" onClick={() => setEditing(e)}>
          Modifier
        </button>
        {confirmDel === e.id ? (
          <button
            type="button"
            className="sa-link sa-danger"
            onClick={() => {
              onDeleteEvent(e.id)
              setConfirmDel(null)
            }}
          >
            Confirmer la suppression ?
          </button>
        ) : (
          <button type="button" className="sa-link sa-danger" onClick={() => setConfirmDel(e.id)}>
            Supprimer
          </button>
        )}
      </span>
    </li>
  )

  const weeks = monthGrid(calYear, calMonth)
  const calDayEvents = calDay ? eventsOnDay(events, calDay) : []

  return (
    <>
      <h1 className="sa-h1">Journal</h1>
      <div className="sa-panel-row sa-journal-toolbar">
        <input
          className="db-input sa-search"
          type="search"
          placeholder="Rechercher dans les notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="db-select" value={filtre} onChange={(e) => setFiltre(e.target.value as 'all' | EventType)}>
          <option value="all">Tous les types ({events.length})</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_ICONS[t]} {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <div className="sa-bodymap-switch">
          <button type="button" className={mode === 'timeline' ? 'active' : ''} onClick={() => setMode('timeline')}>
            Timeline
          </button>
          <button type="button" className={mode === 'calendrier' ? 'active' : ''} onClick={() => setMode('calendrier')}>
            Calendrier
          </button>
        </div>
      </div>

      {mode === 'timeline' ? (
        filtered.length === 0 ? (
          <p className="sa-empty">Aucune entrée.</p>
        ) : (
          [...byDay.keys()].map((d) => (
            <section key={d}>
              <h2 className="sa-h2">{dayLabel(d)}</h2>
              <ul className="sa-day-list">{byDay.get(d)!.map(row)}</ul>
            </section>
          ))
        )
      ) : (
        <section className="sa-cal">
          <div className="sa-cal-head">
            <button
              type="button"
              className="db-btn"
              onClick={() => {
                const d = new Date(calYear, calMonth - 1, 1)
                setCalYear(d.getFullYear())
                setCalMonth(d.getMonth())
              }}
            >
              ‹
            </button>
            <strong>
              {MOIS[calMonth]} {calYear}
            </strong>
            <button
              type="button"
              className="db-btn"
              onClick={() => {
                const d = new Date(calYear, calMonth + 1, 1)
                setCalYear(d.getFullYear())
                setCalMonth(d.getMonth())
              }}
            >
              ›
            </button>
          </div>
          <div className="sa-cal-grid">
            {['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((j) => (
              <div key={j} className="sa-cal-dow">
                {j}
              </div>
            ))}
            {weeks.flat().map((d, i) =>
              d ? (
                <button
                  key={d}
                  type="button"
                  className={`sa-cal-cell${d === today ? ' today' : ''}${d === calDay ? ' active' : ''}${dayMarkers(events, d).saisie ? '' : ' empty'}`}
                  onClick={() => setCalDay(d)}
                >
                  <span className="sa-cal-num">{Number(d.slice(8, 10))}</span>
                  <span className="sa-cal-marks" aria-hidden>
                    {dayMarkers(events, d).crise ? '💥' : ''}
                    {dayMarkers(events, d).regles ? '🌸' : ''}
                    {dayMarkers(events, d).saisie ? '✓' : '·'}
                  </span>
                </button>
              ) : (
                <div key={`x${i}`} className="sa-cal-cell null" />
              )
            )}
          </div>
          {calDay && (
            <section>
              <h2 className="sa-h2">{dayLabel(calDay)}</h2>
              {calDayEvents.length === 0 ? (
                <p className="sa-empty">Jour sans saisie.</p>
              ) : (
                <ul className="sa-day-list">{calDayEvents.map(row)}</ul>
              )}
            </section>
          )}
        </section>
      )}

      {editing && (
        <EditModal
          e={editing}
          onClose={() => setEditing(null)}
          onSave={(ev) => {
            onUpdateEvent(ev)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function todayDayOffset(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
