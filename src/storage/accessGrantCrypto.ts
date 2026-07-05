// Copied verbatim from tc-storage's src/crypto/accessGrantCrypto.ts, minus
// the owner-side encryptFolderKeyForRequest (this app is a viewer/requester
// only and never grants folder access).
import { base64ToBytes, bytesToBase64, toArrayBuffer } from '../profile/cryptoEncoding.js'

type AccessGrantPayload = {
  key: string
}

const decoder = new TextDecoder()
const ecdhAlgorithm = { name: 'ECDH', namedCurve: 'P-256' } as const

export type AccessRequestKey = {
  privateKey: CryptoKey
  publicKey: string
}

export async function createAccessRequestKey(): Promise<AccessRequestKey> {
  const pair = await globalThis.crypto.subtle.generateKey(ecdhAlgorithm, true, ['deriveKey']) as CryptoKeyPair
  const publicKey = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', pair.publicKey))
  return { privateKey: pair.privateKey, publicKey: toBase64Url(bytesToBase64(publicKey)) }
}

export async function decryptFolderKeyGrant(options: {
  cipherText: string
  iv: string
  privateKey: CryptoKey
  publicKey: string
}): Promise<string> {
  const peerPublicKey = await importPublicKey(options.publicKey)
  const key = await deriveGrantKey(options.privateKey, peerPublicKey)
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(options.iv)) },
    key,
    toArrayBuffer(base64ToBytes(options.cipherText)),
  )
  const payload = JSON.parse(decoder.decode(decrypted)) as Partial<AccessGrantPayload>
  if (!payload.key) throw new Error('The shared key is missing from the access grant response')
  return payload.key
}

async function importPublicKey(publicKey: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey('raw', toArrayBuffer(base64ToBytes(fromBase64Url(publicKey))), ecdhAlgorithm, false, [])
}

function deriveGrantKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return globalThis.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function toBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  return base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
}
