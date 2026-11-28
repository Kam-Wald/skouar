import { uid } from '../../shared/db'
import { db, type Category, type FieldDef, type FieldType, type Sheet } from './store'

export function removeFieldFromCategory(cat: Category, fieldId: string): Category {
  const f = cat.fields.find((x) => x.id === fieldId)
  if (!f) return cat
  return {
    ...cat,
    fields: cat.fields.filter((x) => x.id !== fieldId),
    removedFields: [...cat.removedFields.filter((r) => r.id !== fieldId), f]
  }
}

export function restoreEquivalentField(
  cat: Category,
  label: string,
  type: FieldType,
  options?: string[]
): { cat: Category; restored: boolean } {
  const norm = label.trim().toLowerCase()
  const old = cat.removedFields.find((r) => r.label.trim().toLowerCase() === norm && r.type === type)
  if (old) {
    const f: FieldDef = { ...old, label: label.trim(), options: type === 'liste' ? options ?? old.options : undefined }
    return {
      cat: { ...cat, fields: [...cat.fields, f], removedFields: cat.removedFields.filter((r) => r.id !== old.id) },
      restored: true
    }
  }
  const f: FieldDef = { id: uid(), label: label.trim(), type, options: type === 'liste' ? options : undefined }
  return { cat: { ...cat, fields: [...cat.fields, f] }, restored: false }
}

export function moveField(cat: Category, fieldId: string, dir: -1 | 1): Category {
  const i = cat.fields.findIndex((f) => f.id === fieldId)
  const j = i + dir
  if (i < 0 || j < 0 || j >= cat.fields.length) return cat
  const fields = [...cat.fields]
  const tmp = fields[i]
  fields[i] = fields[j]
  fields[j] = tmp
  return { ...cat, fields }
}

export async function saveCategory(cat: Category): Promise<void> {
  await db.table<Category, string>('categories').put(cat)
}

export async function deleteCategory(catId: string, moveTo: string | null): Promise<void> {
  if (moveTo) {
    await db
      .table<Sheet, string>('sheets')
      .filter((s) => s.categoryId === catId)
      .modify({ categoryId: moveTo })
  } else {
    await db
      .table<Sheet, string>('sheets')
      .filter((s) => s.categoryId === catId)
      .delete()
  }
  await db.table<Category, string>('categories').delete(catId)
}

export function countSheetsOf(sheets: Sheet[], catId: string): number {
  return sheets.filter((s) => s.categoryId === catId).length
}
