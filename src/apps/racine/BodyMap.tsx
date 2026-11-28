import { BODY_ZONES } from './crise'

interface Props {
  selected: string | null
  onPick: (zoneId: string) => void
}

export default function BodyMap({ selected, onPick }: Props): JSX.Element {
  return (
    <div className="ra-bodymap" role="group" aria-label="Carte du corps">
      <svg viewBox="0 0 200 420" className="ra-bodymap-svg" aria-hidden="true">
        <ellipse cx="100" cy="30" rx="26" ry="30" />
        <rect x="88" y="56" width="24" height="18" rx="6" />
        <rect x="58" y="72" width="84" height="112" rx="22" />
        <rect x="30" y="80" width="22" height="112" rx="10" />
        <rect x="148" y="80" width="22" height="112" rx="10" />
        <rect x="60" y="184" width="80" height="42" rx="14" />
        <rect x="64" y="226" width="32" height="178" rx="13" />
        <rect x="104" y="226" width="32" height="178" rx="13" />
      </svg>
      {BODY_ZONES.map((z) => (
        <button
          key={z.id}
          type="button"
          className={`ra-zone${selected === z.id ? ' active' : ''}`}
          style={{ left: `${z.left}%`, top: `${z.top}%`, width: `${z.w}%`, height: `${z.h}%` }}
          aria-label={`Zone du corps : ${z.label}`}
          aria-pressed={selected === z.id}
          title={z.label}
          onClick={() => onPick(z.id)}
        />
      ))}
    </div>
  )
}
