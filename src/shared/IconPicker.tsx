import {
  BookOpen,
  Briefcase,
  Cake,
  Camera,
  Car,
  Dumbbell,
  Gamepad2,
  Gift,
  Hammer,
  Heart,
  Home,
  Key,
  Leaf,
  Lightbulb,
  Music,
  Palette,
  PiggyBank,
  Plane,
  ShoppingCart,
  Star,
  Utensils,
  Wrench,
  type LucideIcon
} from 'lucide-react'

export const LUCIDE_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  briefcase: Briefcase,
  cake: Cake,
  camera: Camera,
  car: Car,
  dumbbell: Dumbbell,
  gamepad: Gamepad2,
  gift: Gift,
  hammer: Hammer,
  heart: Heart,
  home: Home,
  key: Key,
  leaf: Leaf,
  bulb: Lightbulb,
  music: Music,
  palette: Palette,
  piggy: PiggyBank,
  plane: Plane,
  cart: ShoppingCart,
  star: Star,
  utensils: Utensils,
  wrench: Wrench
}

export function IconView({ name, size = 16 }: { name: string; size?: number }): JSX.Element {
  const C = LUCIDE_ICONS[name] ?? Star
  return <C size={size} aria-hidden />
}

export default function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="icon-picker" role="listbox" aria-label="Icône du dossier">
      {Object.entries(LUCIDE_ICONS).map(([name, C]) => (
        <button
          key={name}
          type="button"
          role="option"
          aria-selected={value === name}
          className={`icon-picker-btn${value === name ? ' active' : ''}`}
          onClick={() => onChange(name)}
          title={name}
        >
          <C size={16} aria-hidden />
        </button>
      ))}
    </div>
  )
}
