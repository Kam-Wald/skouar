// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import 'fake-indexeddb/auto'
import { db, listAttachments } from '../src/apps/racine/store'
import { addAttachment, fmtSize, MAX_ATTACHMENT, quotaWarning, validateAttachment } from '../src/apps/racine/profil'

describe('racine — profil + pièces jointes (CDC §9, logique)', () => {
  it('validateAttachment : limite 8 Mo ferme', () => {
    expect(validateAttachment({ name: 'a.pdf', size: MAX_ATTACHMENT })).toBeNull()
    expect(validateAttachment({ name: 'a.pdf', size: MAX_ATTACHMENT + 1 })).toContain('trop lourde')
    expect(validateAttachment({ name: 'a.pdf', size: 10 })).toBeNull()
  })

  it('fmtSize : Ko / Mo en FR', () => {
    expect(fmtSize(500)).toBe('0 Ko')
    expect(fmtSize(2048)).toBe('2 Ko')
    expect(fmtSize(1048576)).toBe('1,0 Mo')
    expect(fmtSize(8 * 1048576)).toBe('8,0 Mo')
  })

  it('addAttachment : pdf conservé tel quel, image « resizée » (fallback = fichier d’origine en jsdom), eventId rattaché', async () => {
    await db.table('attachments').clear()
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], 'ordonnance.pdf', { type: 'application/pdf' })
    const r1 = await addAttachment(pdf, 'rdv-1')
    expect(r1.ok).toBe(true)
    if (r1.ok) {
      expect(r1.a.name).toBe('ordonnance.pdf')
      expect(r1.a.mime).toBe('application/pdf')
      expect(r1.a.eventId).toBe('rdv-1')
    }
    const big = new File([new Uint8Array(MAX_ATTACHMENT + 1)], 'gros.bin', { type: 'application/octet-stream' })
    const r2 = await addAttachment(big, null)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error).toContain('8 Mo')
    const img = new File([new Uint8Array([137, 80, 78, 71])], 'scan.png', { type: 'image/png' })
    const r3 = await addAttachment(img, null)
    expect(r3.ok).toBe(true)
    const all = await listAttachments()
    expect(all.length).toBe(2)
    expect(all.find((a) => a.name === 'ordonnance.pdf')?.eventId).toBe('rdv-1')
  })

  it('quotaWarning : null si storage API absent (jsdom)', async () => {
    expect(await quotaWarning()).toBeNull()
  })
})
