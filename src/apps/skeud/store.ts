import { createAppDb, uid } from '../../shared/db'

export { uid }

export interface SkImage {
  id: string
  name: string
  type: string
  size: number
  w: number
  h: number
  blob: Blob
  orig: Blob
  createdAt: number
  updatedAt: number
}

export const db = createAppDb('skouar-skeud', [
  {
    version: 1,
    stores: {
      images: 'id, createdAt, name'
    }
  }
])

export const imagesT = db.table<SkImage, string>('images')

export const listImages = (): Promise<SkImage[]> => imagesT.orderBy('createdAt').toArray()
export const putImage = (img: SkImage): Promise<string> => imagesT.put(img).then(() => img.id)
export const getImage = (id: string): Promise<SkImage | undefined> => imagesT.get(id)
export const delImage = (id: string): Promise<void> => imagesT.delete(id)
