// WebAuthn / Passkeys integration for the "Use Biometrics" unlock option.
//
// This app has no backend, so there is nowhere to verify an attestation or
// assertion signature server-side. The trade-off we make deliberately: a
// successful `navigator.credentials.get()` call already means the platform
// authenticator (Face ID / Touch ID / Windows Hello / Android biometrics)
// verified the person against a private key that never leaves this device
// and is bound to this origin — that's exactly the guarantee we need for a
// local device-unlock convenience, even without a server to check the
// signature against. We only store the credential's public rawId locally
// so we know which credential to ask for.

const RP_NAME = 'ImplaTrax'

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Registers a new passkey for this device. Returns the credential's rawId (base64url) to persist, or null if the user cancelled/it failed. */
export async function registerPasskey(displayName: string, contact: string): Promise<string | null> {
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: contact || displayName,
          displayName,
        },
        challenge: randomChallenge(),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    if (!credential) return null
    return bufferToBase64Url(credential.rawId)
  } catch {
    return null
  }
}

/** Asks the platform authenticator to verify the enrolled credential. Resolves true only if the assertion succeeds. */
export async function verifyPasskey(credentialId: string): Promise<boolean> {
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ type: 'public-key', id: base64UrlToBuffer(credentialId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return assertion != null
  } catch {
    return false
  }
}
