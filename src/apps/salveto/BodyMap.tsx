import { useState } from 'react'
import { BODY_ZONES } from './logic'

interface Props {
  selected: string[]
  onToggle: (id: string) => void
}

export default function BodyMap({ selected, onToggle }: Props) {
  const [view, setView] = useState<'face' | 'dos'>('face')
  const labelOf = (id: string): string => BODY_ZONES.find((z) => z.id === id)?.label ?? id
  const zone = (id: string, shapes: JSX.Element): JSX.Element => (
    <g
      key={id}
      data-zone={id}
      className={`sa-body-zone${selected.includes(id) ? ' active' : ''}`}
      onClick={() => onToggle(id)}
      role="button"
      aria-label={labelOf(id)}
    >
      <title>{labelOf(id)}</title>
      {shapes}
    </g>
  )
  return (
    <div className="sa-bodymap">
      <div className="sa-bodymap-switch">
        <button type="button" className={view === 'face' ? 'active' : ''} onClick={() => setView('face')}>
          Face
        </button>
        <button type="button" className={view === 'dos' ? 'active' : ''} onClick={() => setView('dos')}>
          Dos
        </button>
      </div>
      <svg viewBox="0 0 200 372" className="sa-bodymap-svg" role="group" aria-label="Carte du corps cliquable">
        {zone('tete', <circle cx="100" cy="34" r="20" />)}
        {zone('cou', <rect x="91" y="52" width="18" height="14" rx="5" />)}
        {zone(
          'epaule',
          <>
            <circle cx="70" cy="76" r="11" />
            <circle cx="130" cy="76" r="11" />
          </>
        )}
        {view === 'face' ? (
          <>
            {zone('poitrine', <rect x="76" y="66" width="48" height="36" rx="12" />)}
            {zone('ventre', <rect x="78" y="104" width="44" height="42" rx="12" />)}
            {zone(
              'hanche',
              <>
                <circle cx="82" cy="152" r="10" />
                <circle cx="118" cy="152" r="10" />
              </>
            )}
          </>
        ) : (
          <>
            {zone('dos', <rect x="76" y="64" width="48" height="84" rx="14" />)}
            {zone('hanche', <rect x="78" y="140" width="44" height="26" rx="10" />)}
          </>
        )}
        {zone(
          'bras',
          <>
            <rect x="-8" y="0" width="16" height="80" rx="8" transform="translate(70 86) rotate(10)" />
            <rect x="-8" y="0" width="16" height="80" rx="8" transform="translate(130 86) rotate(-10)" />
          </>
        )}
        {zone(
          'main',
          <>
            <circle cx="57" cy="172" r="8" />
            <circle cx="143" cy="172" r="8" />
          </>
        )}
        {zone(
          'cuisse',
          <>
            <rect x="-9" y="0" width="18" height="84" rx="9" transform="translate(87 158)" />
            <rect x="-9" y="0" width="18" height="84" rx="9" transform="translate(113 158)" />
          </>
        )}
        {zone(
          'genou',
          <>
            <circle cx="86" cy="250" r="9" />
            <circle cx="114" cy="250" r="9" />
          </>
        )}
        {zone(
          'mollet',
          <>
            <rect x="-7" y="0" width="14" height="76" rx="7" transform="translate(85 258)" />
            <rect x="-7" y="0" width="14" height="76" rx="7" transform="translate(115 258)" />
          </>
        )}
        {zone(
          'pied',
          <>
            <ellipse cx="83" cy="346" rx="10" ry="15" />
            <ellipse cx="117" cy="346" rx="10" ry="15" />
          </>
        )}
      </svg>
      <p className="sa-bodymap-hint">
        {selected.length
          ? `${selected.length} zone${selected.length > 1 ? 's' : ''} : ${selected.map(labelOf).join(', ')}`
          : 'Clique sur les zones concernées (multi-sélection)'}
      </p>
    </div>
  )
}
