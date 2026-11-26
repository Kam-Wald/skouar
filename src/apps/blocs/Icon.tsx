import type { LucideIcon } from 'lucide-react'
import {
  Home, FileText, Star, Heart, Calendar, Clock, ListTodo, Folder, Briefcase,
  GraduationCap, Plane, BookOpen, Film, Music, Camera, ShoppingCart, Wallet,
  Target, Lightbulb, PenLine, Mail, Phone, MapPin, Globe, Settings, Search,
  Bell, Trash2, Plus, Link2, Image, Video, Mic, Table, Sigma, QrCode, Timer,
  LayoutDashboard, Network, Sparkles, Bookmark, Tag, Users, Coffee, Moon, Sun,
  Leaf, Rocket, CheckSquare, Paperclip, Gift, Dumbbell, UtensilsCrossed, Eye, Lock
} from 'lucide-react'

export const LUCIDE: Record<string, LucideIcon> = {
  Home, FileText, Star, Heart, Calendar, Clock, ListTodo, Folder, Briefcase,
  GraduationCap, Plane, BookOpen, Film, Music, Camera, ShoppingCart, Wallet,
  Target, Lightbulb, PenLine, Mail, Phone, MapPin, Globe, Settings, Search,
  Bell, Trash2, Plus, Link2, Image, Video, Mic, Table, Sigma, QrCode, Timer,
  LayoutDashboard, Network, Sparkles, Bookmark, Tag, Users, Coffee, Moon, Sun,
  Leaf, Rocket, CheckSquare, Paperclip, Gift, Dumbbell, UtensilsCrossed, Eye, Lock
}

export const LUCIDE_NAMES = Object.keys(LUCIDE)

export function isLucideIcon(icon: string): boolean {
  return icon.startsWith('lucide:')
}

export function isEmojiIcon(icon: string): boolean {
  return (
    !icon.startsWith('lucide:') &&
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{25A0}-\u{25FF}\u{2190}-\u{21FF}\u{2B50}-\u{2B55}]/u.test(icon)
  )
}

export default function AppIcon({
  icon,
  size = 18,
  color
}: {
  icon: string
  size?: number
  color?: string | null
}) {
  const glyphColor = isEmojiIcon(icon) ? undefined : color ?? undefined
  if (isLucideIcon(icon)) {
    const C = LUCIDE[icon.slice(7)]
    if (C) return <C size={size} strokeWidth={2} style={glyphColor ? { color: glyphColor } : undefined} />
    return <span>{icon.slice(7)}</span>
  }
  return <span style={glyphColor ? { color: glyphColor } : undefined}>{icon}</span>
}
