import { useEffect, useState } from 'react'
import { useDismiss } from './shared/useDismiss'
import { ACCENTS, applyTheme, getAccent, getTheme } from './ThemeButton'
import { HL_THEMES } from './apps/kod/themes'
import { KEYMAP_ACTIONS, keymapToText, parseKeymapText } from './apps/kod/keymap'

export const SETTINGS_EVENT = 'skouar:settings'
const KEY = 'skouar:settings'

export type AppSettings = Record<string, unknown>

export function loadAllSettings(): { apps: Record<string, AppSettings> } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { apps: v.apps && typeof v.apps === 'object' ? v.apps : {} }
  } catch {
    return { apps: {} }
  }
}

export function loadAppSettings(appId: string): AppSettings {
  return loadAllSettings().apps[appId] ?? {}
}

export function saveAppSettings(appId: string, patch: AppSettings, broadcast = false): void {
  const all = loadAllSettings()
  all.apps[appId] = { ...all.apps[appId], ...patch }
  localStorage.setItem(KEY, JSON.stringify(all))
  if (broadcast) window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))
}

export function broadcastSettings(): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_EVENT))
}

interface Props {
  appId?: string
  appName?: string
}

export default function SettingsButton({ appId, appName }: Props) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(getTheme())
  const [accent, setAccent] = useState(getAccent())
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem('skouar:sidebarW'))
    return Number.isFinite(v) && v >= 180 && v <= 440 ? v : 240
  })
  const [kod, setKod] = useState<AppSettings>(() => (appId === 'kod' ? loadAppSettings('kod') : {}))
  const [armed, setArmed] = useState(false)
  const [kmText, setKmText] = useState('')
  const [tab, setTab] = useState<'global' | 'app'>('global')

  useDismiss('settings', open, () => setOpen(false))

  useEffect(() => {
    if (!open) return
    setTheme(getTheme())
    setAccent(getAccent())
    if (appId === 'kod') {
      const ks = loadAppSettings('kod')
      setKod(ks)
      setKmText(keymapToText((ks.keymap ?? {}) as Record<string, unknown>))
    }
    setArmed(false)
    setTab('global')
  }, [open, appId])

  useEffect(() => {
    if (!appId) return
    const on = () => setKod(loadAppSettings(appId))
    window.addEventListener(SETTINGS_EVENT, on)
    return () => window.removeEventListener(SETTINGS_EVENT, on)
  }, [appId])

  const choose = (t: string, a: string): void => {
    applyTheme(t, a)
    setTheme(t)
    setAccent(a)
  }

  const setKodField = (k: string, v: unknown): void => {
    const next = { ...kod, [k]: v }
    setKod(next)
    saveAppSettings('kod', next, true)
  }

  const wipeApp = (): void => {
    if (!appId) return
    if (!armed) {
      setArmed(true)
      return
    }
    localStorage.removeItem(KEY)
    const map: Record<string, string> = {
      kod: 'skouar-kod',
      blocs: 'skouar-blocs',
      skrid: 'skouar-skrid',
      ler: 'skouar-ler'
    }
    const name = map[appId]
    if (name && 'indexedDB' in window) {
      indexedDB.deleteDatabase(name)
    }
    location.reload()
  }

  return (
    <div className="settings-wrap" data-pop="settings">
      <button
        className="blocs-io"
        aria-label="Réglages"
        title="Réglages (généraux + de l'appli)"
        onClick={() => setOpen((o) => !o)}
      >
        ⚙️ Réglages
      </button>
      {open && (
        <div className="settings-modal" role="dialog" aria-label="Réglages">
          <div className="settings-head">
            <strong>⚙️ Réglages</strong>
            <button className="db-btn" aria-label="Fermer les réglages" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="settings-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'global'} className={`settings-tab-btn${tab === 'global' ? ' active' : ''}`} onClick={() => setTab('global')}>
              🌐 Général
            </button>
            {appId && (
              <button role="tab" aria-selected={tab === 'app'} className={`settings-tab-btn${tab === 'app' ? ' active' : ''}`} onClick={() => setTab('app')}>
                🧩 {appName ?? appId}
              </button>
            )}
          </div>
          <div className="settings-body">
            {tab === 'global' && (
            <section>
              <h3>🌐 Général — tout Skouar</h3>
              <div className="theme-row">
                <button className={`db-btn${theme === 'light' ? ' active' : ''}`} onClick={() => choose('light', accent)}>
                  ☀️ Clair
                </button>
                <button className={`db-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => choose('dark', accent)}>
                  🌙 Sombre
                </button>
              </div>
              <div className="emoji-colors">
                {ACCENTS.map((a) => (
                  <button
                    key={a}
                    className={`emoji-color${accent === a ? ' active' : ''}`}
                    style={{ backgroundColor: a }}
                    title={a}
                    aria-label={`Accent ${a}`}
                    onClick={() => choose(theme, a)}
                  />
                ))}
              </div>
              <label className="settings-field">
                <span>Largeur de la barre latérale par défaut (px)</span>
                <input
                  type="number"
                  min={180}
                  max={440}
                  value={sideW}
                  onChange={(e) => {
                    const v = Math.min(440, Math.max(180, Number(e.target.value) || 240))
                    setSideW(v)
                    localStorage.setItem('skouar:sidebarW', String(v))
                  }}
                />
              </label>
              <button className="db-btn" onClick={() => location.reload()}>
                🔄 Recharger l'application
              </button>
            </section>
            )}
            {tab === 'app' && appId && (
              <section>
                <h3>🧩 {appName ?? appId}</h3>
                {appId === 'kod' && (
                  <>
                    <label className="settings-field">
                      <span>Taille de police de l'éditeur (px)</span>
                      <input
                        type="number"
                        min={10}
                        max={22}
                        value={Number(kod.fontSize ?? 13)}
                        onChange={(e) => setKodField('fontSize', Math.min(22, Math.max(10, Number(e.target.value) || 13)))}
                      />
                    </label>
                    <label className="settings-field">
                      <span>Indentation (espaces)</span>
                      <select value={Number(kod.tabSize ?? 2)} onChange={(e) => setKodField('tabSize', Number(e.target.value))}>
                        <option value={2}>2</option>
                        <option value={4}>4</option>
                        <option value={8}>8</option>
                      </select>
                    </label>
                    <label className="settings-field">
                      <span>Thème de coloration</span>
                      <select value={String(kod.hlTheme ?? 'default')} onChange={(e) => setKodField('hlTheme', e.target.value)}>
                        {HL_THEMES.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={kod.wrap === true}
                        onChange={(e) => setKodField('wrap', e.target.checked)}
                      />
                      <span>Retour à la ligne automatique</span>
                    </label>
                    <label className="settings-check">
                      <input
                        type="checkbox"
                        checked={kod.mini !== false}
                        onChange={(e) => setKodField('mini', e.target.checked)}
                      />
                      <span>Afficher la minimap</span>
                    </label>
                    <label className="settings-field">
                      <span>
                        Raccourcis clavier (un par ligne : <code>action: raccourci</code>, ex. <code>find: C-F</code>)
                      </span>
                      <textarea
                        className="set-keymap"
                        rows={5}
                        value={kmText}
                        placeholder={'save: C-S\nfind: C-F\ngfind: C-S-F\ngoto: C-G'}
                        onChange={(e) => setKmText(e.target.value)}
                        onBlur={() => setKodField('keymap', parseKeymapText(kmText))}
                      />
                      <small className="settings-muted">{KEYMAP_ACTIONS.map((a) => `${a.id} = ${a.label}`).join(' · ')}</small>
                    </label>
                  </>
                )}
                {appId !== 'kod' && <p className="settings-muted">Les réglages de cette appli arrivent bientôt ici.</p>}
                <button className={`db-btn danger${armed ? ' armed' : ''}`} onClick={wipeApp}>
                  {armed ? `⚠️ Confirmer : effacer toutes les données de ${appName ?? appId} ?` : `🗑 Effacer les données de ${appName ?? appId}`}
                </button>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
