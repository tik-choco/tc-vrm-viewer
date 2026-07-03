import type { FileBundle, FileRecord, FolderBundle } from './domain.js'

export type ImportedVrmFile = {
  name: string
  mimeType: string
  size: number
  bytes: Uint8Array
}

const VRM_EXTENSION = /\.vrm$/i
const VRM_MIME_TYPE = 'model/gltf-binary'

/**
 * Parses a FolderBundle or FileBundle JSON string (per tc-storage's
 * bundle export format) and returns the VRM files it contains, decoded
 * from their dataUrl. Non-VRM files are skipped. Throws on invalid JSON
 * or a JSON shape that isn't a recognizable bundle.
 */
export function parseBundleJson(raw: string): ImportedVrmFile[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid bundle JSON')
  }
  const files = fileRecordsFromBundle(parsed)
  if (!files) throw new Error('Not a recognizable FolderBundle or FileBundle')
  return files.filter(isVrmFileRecord).map(fileRecordToImportedVrm)
}

function fileRecordsFromBundle(value: unknown): FileRecord[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Partial<FolderBundle & FileBundle>
  if (record.version !== 1 || typeof record.exportedAt !== 'string' || typeof record.originNode !== 'string') return undefined
  if (Array.isArray(record.files)) return record.files
  if (record.file && typeof record.file === 'object') return [record.file]
  return undefined
}

function isVrmFileRecord(file: FileRecord): boolean {
  return Boolean(file.dataUrl) && (file.mimeType === VRM_MIME_TYPE || VRM_EXTENSION.test(file.name))
}

function fileRecordToImportedVrm(file: FileRecord): ImportedVrmFile {
  return {
    name: file.name,
    mimeType: file.mimeType || VRM_MIME_TYPE,
    size: file.size,
    bytes: bytesFromDataUrl(file.dataUrl as string),
  }
}

/** Decodes a `data:...;base64,...` URL into raw bytes. */
export function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1 || !dataUrl.slice(0, commaIndex).includes('base64')) {
    throw new Error('Unsupported dataUrl encoding (expected base64)')
  }
  const base64 = dataUrl.slice(commaIndex + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index])
  return `data:${mimeType};base64,${btoa(binary)}`
}
