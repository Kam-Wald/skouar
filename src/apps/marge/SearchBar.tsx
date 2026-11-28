import { useDismiss } from '../../shared/useDismiss'
import type { DocViewer } from './viewer'

export default function SearchBar({ v }: { v: DocViewer }) {
  useDismiss('margesearch', true, () => v.closeSearch())
  return (
    <div className="marge-search" data-pop="margesearch">
      <input
        className="db-input"
        autoFocus
        placeholder="Rechercher… (Ctrl+F)"
        value={v.searchQ}
        onChange={(e) => v.setSearchQ(e.target.value)}
      />
      <select
        className="db-input"
        value={v.searchFilter}
        onChange={(e) => v.setSearchFilter(e.target.value as 'doc' | 'annots' | 'all')}
        title="Où chercher"
      >
        <option value="all">Document + mes annotations</option>
        <option value="doc">Texte du document</option>
        <option value="annots">Mes annotations</option>
      </select>
      <span className="marge-muted">
        {v.matches.length ? `${Math.min(v.mIdx + 1, v.matches.length)}/${v.matches.length}` : '0'}
      </span>
      <button className="db-btn" title="Précédent (Maj+Entrée)" onMouseDown={(e) => e.preventDefault()} onClick={() => v.stepMatch(-1)}>
        ↑
      </button>
      <button className="db-btn" title="Suivant (Entrée)" onMouseDown={(e) => e.preventDefault()} onClick={() => v.stepMatch(1)}>
        ↓
      </button>
      <button className="db-btn" title="Fermer (Échap)" onClick={() => v.closeSearch()}>
        ✕
      </button>
    </div>
  )
}
