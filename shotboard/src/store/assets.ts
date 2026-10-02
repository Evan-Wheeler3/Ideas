// Imported model files live here (not in the undoable store, they can be large).
// The project only keeps a reference (Project.assets). Saving writes these into the project file.
const files = new Map<string, { data: ArrayBuffer; url: string }>()

export function putAsset(id: string, data: ArrayBuffer): string {
  const existing = files.get(id)
  if (existing) URL.revokeObjectURL(existing.url)
  const url = URL.createObjectURL(new Blob([data], { type: 'model/gltf-binary' }))
  files.set(id, { data, url })
  return url
}

export const assetUrl = (id: string): string | undefined => files.get(id)?.url
export const assetData = (id: string): ArrayBuffer | undefined => files.get(id)?.data
