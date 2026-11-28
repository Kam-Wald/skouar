import { useRef, useState } from 'react'
import { notify } from '../../shared/notify'
import { snapshotBeforeImport } from '../../shared/backup'
import { importData, exportData, backupFileName } from './io'
import { db } from './store'
import type { Folder, Memo, UnvezSettings } from './store'

interface Props {
  settings: UnvezSettings
  onSettings: (patch: Partial<UnvezSettings>) => void
  memos: Memo[]
  folders: Folder[]
  onReload: () => Promise<void>
}

export default function SettingsPanel({ settings, onSettings, memos, folders, onReload }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = (): void => {
    try {
      const json = exportData(memos, folders, settings)
      const blob = new Blob([json], { type: 'application/json' })
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = backupFileName()
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      }
      notify('Sauvegarde JSON exportée')
    } catch {
      notify('Export impossible')
    }
  }

  const doImport = async (f: File): Promise<void> => {
    try {
      const text = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(String(fr.result))
        fr.onerror = () => rej(fr.error)
        fr.readAsText(f)
      })
      const how = await snapshotBeforeImport()
      notify(how === 'localStorage' ? 'Snapshot de sécurité enregistré avant import' : 'Snapshot de sécurité téléchargé (ZIP) avant import')
      const r = await importData(db, text)
      if (settings.lastFamily) onSettings({})
      await onReload()
      notify(`Import OK : ${r.memos} mémo(s), ${r.folders} dossier(s) — rechargement…`)
      setTimeout(() => location.reload(), 900)
    } catch (e) {
      notify(`Import interrompu (${e instanceof Error ? e.message : 'fichier illisible'}) — données actuelles intactes, snapshot fait avant`)
    }
  }

  return (
    <>
      <label className="settings-field">
        <span>Précision par défaut (décimales)</span>
        <select
          aria-label="Unvez — décimales"
          value={settings.decimals}
          onChange={(e) => onSettings({ decimals: Number(e.target.value) })}
        >
          {[2, 4, 6, 8, 10].map((d) => (
            <option key={d} value={d}>{d} déc.</option>
          ))}
        </select>
      </label>
      <label className="settings-check">
        <input
          type="checkbox"
          aria-label="Unvez — calculatrice scientifique"
          checked={settings.sci !== false}
          onChange={(e) => onSettings({ sci: e.target.checked })}
        />
        <span>Calculatrice scientifique</span>
      </label>
      <label className="settings-field">
        <span>Convention cuisine</span>
        <select
          aria-label="Unvez — convention cuisine"
          value={settings.cook}
          onChange={(e) => onSettings({ cook: e.target.value as 'us' | 'metric' })}
        >
          <option value="metric">Métrique (tasse = 250 ml, tbsp = 15 ml)</option>
          <option value="us">US (tasse ≈ 236,6 ml, tbsp ≈ 14,79 ml)</option>
        </select>
      </label>
      <div className="settings-sep" />
      <button type="button" className="db-btn" onClick={doExport}>
        💾 Exporter mes données Unvez (JSON)
      </button>
      <button
        type="button"
        className={`db-btn danger${armed ? ' armed' : ''}`}
        onClick={() => {
          if (!armed) {
            setArmed(true)
            return
          }
          fileRef.current?.click()
        }}
      >
        {armed ? '⚠️ Confirmer l’import (remplace mémos + dossiers actuels) ?' : '📥 Importer une sauvegarde Unvez (JSON)'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Fichier de sauvegarde Unvez"
        onChange={(e) => {
          const f = e.target.files?.[0]
          setArmed(false)
          if (f) void doImport(f)
          e.target.value = ''
        }}
      />
    </>
  )
}
