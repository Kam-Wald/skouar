import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fmtDay } from './events'
import { startOfDay } from './agenda'
import { EFFET_LABELS, efficaciteStats } from './traitement'
import { rdvSorted } from './agenda'
import { MONTHS_FR } from './vues'
import type { HealthEvent, Profile, RefEntity } from './store'

const DAY = 86400000

export interface RapportMensuel {
  label: string
  nbCrises: number
  avgMoral: number | null
  avgEnergie: number | null
  avgSommeil: number | null
  joursSaisis: number
  totalEntrees: number
}

const avg = (vals: number[]): number | null => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null)

export function rapportMensuel(events: HealthEvent[], now = Date.now()): RapportMensuel {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = d.getMonth()
  const start = new Date(y, m, 1).getTime()
  const end = new Date(y, m + 1, 1).getTime()
  const inMonth = events.filter((e) => e.date >= start && e.date < end)
  const days = new Set(inMonth.map((e) => startOfDay(e.date)))
  return {
    label: `${MONTHS_FR[m]} ${y}`,
    nbCrises: inMonth.filter((e) => e.type === 'crise').length,
    avgMoral: avg(inMonth.filter((e) => e.type === 'moral').map((e) => Number(e.payload.level) || 0)),
    avgEnergie: avg(inMonth.filter((e) => e.type === 'energie').map((e) => Number(e.payload.level) || 0)),
    avgSommeil: avg(inMonth.filter((e) => e.type === 'sommeil').map((e) => Number(e.payload.qualite) || 0)),
    joursSaisis: days.size,
    totalEntrees: inMonth.length
  }
}

export interface FicheMedecin {
  genereeLe: number
  depuis: number | null
  profile: Profile
  crises: HealthEvent[]
  symptomes: HealthEvent[]
  traitements: { name: string; score: number; counts: Record<string, number> }[]
  questions: string[]
}

export function ficheMedecinData(profile: Profile, events: HealthEvent[], refs: RefEntity[], questions: string[], now = Date.now()): FicheMedecin {
  const rdvs = rdvSorted(events).filter((e) => (e.payload.date as number) < startOfDay(now))
  const lastRdv = rdvs.length ? (rdvs[rdvs.length - 1].payload.date as number) : now - 30 * DAY
  const depuis = lastRdv
  const inWindow = events.filter((e) => e.date >= depuis && e.date <= now)
  return {
    genereeLe: now,
    depuis,
    profile,
    crises: inWindow.filter((e) => e.type === 'crise'),
    symptomes: inWindow.filter((e) => e.type === 'symptome'),
    traitements: efficaciteStats(events, refs).map((s) => ({ name: s.name, score: Math.round(s.score * 10) / 10, counts: s.counts })),
    questions
  }
}

const PDF_SAFE: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '«': '"',
  '»': '"',
  '—': '-',
  '–': '-',
  '…': '...',
  '€': 'EUR',
  '★': '*',
  '🚨': ''
}

export function pdfText(s: string): string {
  return String(s)
    .replace(/[’‘“”«»—–…€★🚨]/g, (c) => PDF_SAFE[c] ?? '')
    .replace(/[^\x00-\xFF]/g, '?')
}

export async function genFicheMedecinPDF(f: FicheMedecin): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([595, 842])
  const { width, height } = page.getSize()
  let y = height - 50
  const line = (text: string, size = 11, b = false): void => {
    if (y < 50) {
      y = height - 50
    }
    page.drawText(pdfText(text), { x: 50, y, size, font: b ? bold : font, color: rgb(0, 0, 0) })
    y -= size + 6
  }
  const section = (t: string): void => {
    y -= 8
    line(t, 13, true)
  }
  line('Fiche medecin - Racine (100 % local)', 16, true)
  line(`Generee le ${fmtDay(f.genereeLe)} — depuis la derniere visite : ${f.depuis ? fmtDay(f.depuis) : '30 j'}`, 10)
  section('Profil sante')
  line(`Allergies : ${f.profile.allergies || '-'}`)
  line(`Groupe sanguin : ${f.profile.groupeSanguin || '-'}`)
  line(`Traitements en cours : ${f.profile.traitementsCours || '-'}`)
  line(`Maladies diagnostiquees : ${f.profile.maladies || '-'}`)
  line(`Antecedents : ${f.profile.antecedents || '-'}`)
  line(`Personne a contacter : ${f.profile.contactUrgence || '-'}`)
  section(`Crises depuis la derniere visite (${f.crises.length})`)
  for (const c of f.crises.slice(0, 30)) {
    line(`- ${fmtDay(c.date)} : intensite ${c.payload.intensity ?? '?'}/10${c.payload.zone ? `, ${c.payload.zone}` : ''}${c.note ? ` — ${c.note}` : ''}`)
  }
  if (!f.crises.length) line('- aucune')
  section(`Symptomes depuis la derniere visite (${f.symptomes.length})`)
  for (const s of f.symptomes.slice(0, 30)) {
    line(`- ${fmtDay(s.date)} : ${s.payload.type} — ${s.payload.intensite}/10`)
  }
  if (!f.symptomes.length) line('- aucun')
  section('Traitements et retours d’efficacite')
  for (const t of f.traitements) {
    const counts = Object.entries(t.counts).map(([k, n]) => `${n} ${EFFET_LABELS[k as keyof typeof EFFET_LABELS]?.toLowerCase() ?? k}`).join(', ')
    line(`- ${t.name} : score ${t.score >= 0 ? '+' : ''}${String(t.score).replace('.', ',')} (${counts})`)
  }
  if (!f.traitements.length) line('- aucun retour enregistre')
  section('Questions a poser')
  for (const q of f.questions) line(`- ${q}`)
  if (!f.questions.length) line('- aucune')
  return doc.save()
}
