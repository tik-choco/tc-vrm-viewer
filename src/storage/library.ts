import { makeId, type FileRecord } from './domain.js'

const DB_NAME = 'tc-vrm-viewer'
const DB_VERSION = 1
const STORE_NAME = 'models'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function addModelToLibrary(options: {
  name: string
  mimeType: string
  size: number
  dataUrl: string
  checksum: string
}): Promise<FileRecord> {
  const now = new Date().toISOString()
  const record: FileRecord = {
    id: makeId('file'),
    folderId: 'library',
    name: options.name,
    mimeType: options.mimeType,
    size: options.size,
    dataUrl: options.dataUrl,
    checksum: options.checksum,
    version: 1,
    starred: false,
    createdAt: now,
    updatedAt: now,
  }
  const db = await openDb()
  await runTransaction(db, 'readwrite', (store) => store.put(record))
  db.close()
  return record
}

export async function listLibraryModels(): Promise<FileRecord[]> {
  const db = await openDb()
  const records = await new Promise<FileRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve(request.result as FileRecord[])
    request.onerror = () => reject(request.error)
  })
  db.close()
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function removeModelFromLibrary(id: string): Promise<void> {
  const db = await openDb()
  await runTransaction(db, 'readwrite', (store) => store.delete(id))
  db.close()
}

function runTransaction(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    run(tx.objectStore(STORE_NAME))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function checksumOf(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
