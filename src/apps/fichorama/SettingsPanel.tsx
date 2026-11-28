import { useRef, useState } from 'react'
import { notify } from '../../shared/notify'
import { snapshotBeforeImport } from '../../shared/backup'
import { backupFileName, exportData, importData, type ImportMode } from './io'
import type { Category, Sheet } from './store'

interface Props {
  categories: Category[]
  sheets: Sheet[]
  onReload: () => Promise<void>
}

export default function SettingsPanel({ categories, sheets, onReload }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  const [mode, setMode] = useState<ImportMode>('fusion')
  const fileRef = useRef<HTMLInputElement>(null)

  const doExport = async (): Promise<void> => {
    try {
      const json = await exportData(categories, sheets)
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
      const r = await importData(text, mode)
      await onReload()
      notify(`Import OK (${mode === 'fusion' ? 'fusion' : 'remplacement'}) : ${r.categories} catégorie(s), ${r.sheets} fiche(s)`)
    } catch (e) {
      notify(`Import interrompu (${e instanceof Error ? e.message : 'fichier illisible'}) — données actuelles intactes, snapshot fait avant`)
    }
  }

  return (
    <>
      <div className="settings-sep" />
      <button type="button" className="db-btn" onClick={() => void doExport()}>
        💾 Exporter mes données Fichorama (JSON)
      </button>
      <label className="settings-field">
        <span>Mode d’import</span>
        <select aria-label="Fichorama — mode d’import" value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
          <option value="fusion">Fusion (ajoute / met à jour par id, garde le reste)</option>
          <option value="remplacer">Remplacer (efface tout avant d’importer)</option>
        </select>
      </label>
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
        {armed ? `⚠️ Confirmer l’import (${mode === 'fusion' ? 'fusion' : 'remplacement total'}) ?` : '📥 Importer une sauvegarde Fichorama (JSON)'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Fichier de sauvegarde Fichorama"
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
