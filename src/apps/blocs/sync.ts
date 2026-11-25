import * as Y from 'yjs'
import { joinRoom } from 'trystero/torrent'

export interface SyncHandle {
  doc: Y.Doc
  code: string
  leave: () => void
}

export function startSync(code: string): SyncHandle {
  const doc = new Y.Doc()
  const room = joinRoom({ appId: 'skouar-blocs-v1' }, code)
  const [sendUpdate, onUpdate] = room.makeAction<Uint8Array>('yjs')

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin !== room) void sendUpdate(update)
  })
  onUpdate((update: Uint8Array) => {
    Y.applyUpdate(doc, update, room)
  })
  void sendUpdate(Y.encodeStateAsUpdate(doc))

  return {
    doc,
    code,
    leave: () => {
      room.leave()
      doc.destroy()
    }
  }
}

export function readRemoteState(doc: Y.Doc): string | null {
  const v = doc.getMap('blocs').get('state')
  return typeof v === 'string' ? v : null
}
