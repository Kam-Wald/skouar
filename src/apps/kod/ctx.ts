import { createContext, useContext } from 'react'
import type { KodApi } from './useKodApp'

export const KodCtx = createContext<KodApi | null>(null)

export const useKod = (): KodApi => {
  const v = useContext(KodCtx)
  if (!v) throw new Error('useKod utilisé hors du provider Kod')
  return v
}
