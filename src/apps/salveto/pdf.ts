import { buildPdf, downloadPdf, wrap, type Line } from '../blocs/pdf'
import {
  bienfaits,
  dayOf,
  dernierRdvPasse,
  fmtDay,
  inWindow,
  resumeSerie,
  serieOf,
  timeOf,
  todayDay,
  type ProfilSante,
  type SalvetoConfig,
  type SalvetoEvent,
  type SalvetoRefs
} from './logic'

export interface FicheMedecinInput {
  profil: ProfilSante
  events: SalvetoEvent[]
  refs: SalvetoRefs
  config: SalvetoConfig
}

function pushWrapped(lines: Line[], text: string, size: number, font: 1 | 2 | 3, indent: number, gapBefore = 0): void {
  const wrapped = wrap(text, size, indent)
  wrapped.forEach((l, i) => {
    lines.push({ text: l, size, font, indent, gapBefore: i === 0 ? gapBefore : 0 })
  })
}

export function ficheMedecinLines(inp: FicheMedecinInput): Line[] {
  const { profil, events, refs, config } = inp
  const lines: Line[] = []
  const H = (t: string): void => {
    lines.push({ text: t, size: 13, font: 2, indent: 0, gapBefore: 12 })
  }
  const P = (t: string): void => pushWrapped(lines, t, 10, 1, 8, 3)

  lines.push({ text: 'Fiche médecin — Salveto', size: 18, font: 2, indent: 0, gapBefore: 0 })
  pushWrapped(lines, `Générée localement le ${fmtDay(todayDay())} — 100 % hors ligne, aucune donnée envoyée.`, 9, 1, 0, 4)

  H('Profil santé')
  P(`Allergies : ${profil.allergies.length ? profil.allergies.join(', ') : '—'}`)
  P(`Groupe sanguin : ${profil.groupeSanguin ?? '—'}`)
  P(`Traitements en cours : ${profil.traitementsEnCours || '—'}`)
  if (profil.maladies.trim()) P(`Maladies diagnostiquées : ${profil.maladies.trim()}`)
  if (profil.antecedents.trim()) P(`Antécédents : ${profil.antecedents.trim()}`)
  if (profil.antecedentsFamiliaux.trim()) P(`Antécédents familiaux : ${profil.antecedentsFamiliaux.trim()}`)
  P(`Contact d’urgence : ${[profil.contactNom, profil.contactTel].filter(Boolean).join(' — ') || '—'}`)
  if (profil.vaccinations.length) {
    P(
      `Vaccinations : ${profil.vaccinations
        .map((v) => `${v.label} (${fmtDay(v.date)}${v.rappel ? `, rappel ${fmtDay(v.rappel)}` : ''})`)
        .join(' ; ')}`
    )
  }

  const rdv = dernierRdvPasse(events)
  H('Depuis la dernière consultation')
  if (rdv) {
    P(`Dernier RDV : ${fmtDay(dayOf(rdv.date))} à ${timeOf(rdv.date)} — ${rdv.label ?? ''}${rdv.lieu ? ` (${rdv.lieu})` : ''}${rdv.crDiag ? ` — compte-rendu : ${rdv.crDiag}` : ''}`)
  } else {
    P('Aucun RDV passé enregistré.')
  }
  const depuis = rdv
    ? events.filter((e) => e.date > rdv.date && ['crise', 'symptome'].includes(e.type))
    : events.filter((e) => ['crise', 'symptome'].includes(e.type))
  if (depuis.length === 0) {
    P('Aucune crise ni symptôme signalé depuis.')
  } else {
    for (const e of depuis.slice(0, 40).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      P(`- ${fmtDay(dayOf(e.date))} — ${e.type === 'crise' ? `Crise ${e.value ?? '?'}/10` : `Symptôme ${e.label ?? ''} ${e.value ?? '?'}/10`}${e.label && e.type === 'crise' ? ` (${e.label})` : ''}${e.notes ? ` : ${e.notes}` : ''}`)
    }
    if (depuis.length > 40) P(`… et ${depuis.length - 40} autre(s) entrée(s).`)
  }

  H('Courbes clés (3 derniers mois)')
  const courbes: [string, SalvetoEvent['type'], string?][] = [
    ['Poids', 'poids', ' kg'],
    ['Moral', 'moral', '/5'],
    ['Énergie', 'energie', '/5'],
    ['Sommeil (qualité)', 'sommeil', '/5'],
    ['Crises (intensité)', 'crise', '/10']
  ]
  for (const [label, type, unit] of courbes) {
    const r = resumeSerie(inWindow(serieOf(events, type), 90))
    P(r ? `${label} : min ${r.min}${unit ?? ''}, max ${r.max}${unit ?? ''}, moyenne ${r.moy}${unit ?? ''} (${inWindow(serieOf(events, type), 90).length} points)` : `${label} : aucune donnée sur 3 mois.`)
  }
  for (const c of refs.items.filter((r) => r.kind === 'constante')) {
    const r = resumeSerie(inWindow(serieOf(events, 'constante', c.id), 90))
    if (r) P(`${c.label}${c.unite ? ` (${c.unite})` : ''} : min ${r.min}, max ${r.max}, moyenne ${r.moy} — seuil indicatif ${c.seuil ?? '—'}`)
  }

  H('Traitements en cours et retours d’efficacité')
  const bien = bienfaits(events, refs)
  if (bien.length === 0) {
    P('Aucun retour d’efficacité noté.')
  } else {
    for (const b of bien.slice(0, 8)) {
      const counts = Object.entries(b.effetCounts)
        .filter(([, n]) => n > 0)
        .map(([e, n]) => `${e} × ${n}`)
        .join(', ')
      P(`- ${b.label} : ${b.prises} prise(s), score ${b.score >= 0 ? `+${b.score}` : b.score}${counts ? ` (${counts})` : ''}`)
    }
  }

  H('Questions à poser à la consultation')
  const qs = config.questionsRdv ?? []
  if (qs.length === 0) P('—')
  else for (const q of qs) P(`- ${q}`)

  pushWrapped(
    lines,
    'Document généré localement par Salveto à partir de vos seules saisies. Aucune interprétation médicale, aucune donnée transmise.',
    8,
    1,
    0,
    14
  )
  return lines
}

export function buildFicheMedecinPdf(inp: FicheMedecinInput): Uint8Array {
  return buildPdf(ficheMedecinLines(inp), {
    toc: false,
    titlePage: false,
    footerText: 'Salveto — fiche médecin générée localement'
  })
}

export function telechargerFicheMedecin(inp: FicheMedecinInput): void {
  downloadPdf(buildFicheMedecinPdf(inp), `salveto-fiche-medecin-${todayDay()}.pdf`)
}
