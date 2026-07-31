/** The person who set up this device during onboarding — kept separate from the AppUser records in DataContext (see AuthContext.tsx for why). */
export interface AuthIdentity {
  name: string
  contact: string
}

export interface AuthSnapshot {
  hasOnboarded: boolean
  identity: AuthIdentity | null
  pinHash: string | null
  pinSalt: string | null
  /** Base64-encoded WebAuthn credential rawId, if the user enrolled a passkey on this device. */
  webauthnCredentialId: string | null
}
