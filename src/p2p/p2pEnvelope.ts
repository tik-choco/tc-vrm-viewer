/**
 * Envelope signing/verification for the folder access-grant handshake.
 * Ported from tc-storage's src/p2p/p2pEnvelope.ts (signShareEnvelope /
 * verifyShareEnvelope / the stable-stringify signing scheme), trimmed to
 * what this receive-only viewer needs: it only ever signs its own outgoing
 * folder-access-request envelopes and verifies incoming grant/denial
 * envelopes, never anything else in tc-storage's app.
 */
import { getStoredDidIdentity, isEd25519DidKey, signStringWithDidIdentity, verifyStringWithDid } from '../profile/didIdentity.js'
import type { ShareEnvelope } from './p2pTypes.js'

export async function signShareEnvelope(envelope: ShareEnvelope): Promise<ShareEnvelope> {
  if (!isEd25519DidKey(envelope.from)) throw new Error('P2P sender must be an Ed25519 did:key')
  const identity = getStoredDidIdentity()
  if (!identity || identity.did !== envelope.from) throw new Error('DID private key is missing')
  return { ...envelope, signature: await signStringWithDidIdentity(identity, envelopeSigningPayload(envelope)) }
}

export async function verifyShareEnvelope(envelope: ShareEnvelope): Promise<boolean> {
  if (!isEd25519DidKey(envelope.from)) return false
  if (!envelope.signature) return false
  return verifyStringWithDid(envelope.from, envelopeSigningPayload(envelope), envelope.signature)
}

function envelopeSigningPayload(envelope: ShareEnvelope): string {
  const unsigned: Record<string, unknown> = { ...envelope }
  delete unsigned.signature
  return stableStringify(unsigned)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`
}
