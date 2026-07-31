function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Random per-device salt so the same PIN never hashes to the same value across devices/installs. */
export function generateSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

/**
 * Hashes a PIN with SHA-256 before it ever touches localStorage. This is a
 * local device-unlock gate, not a server-verified credential — there is no
 * backend to brute-force against, so SHA-256 + a random salt is proportionate
 * (matches the "no unnecessary dependencies" constraint: no bcrypt needed).
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return toHex(digest)
}
