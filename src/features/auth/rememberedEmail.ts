const KEY = 'implatrax:auth:rememberedEmail'

/** Pre-fills the Log In form's email field next time — never stores a password. */
export function getRememberedEmail(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setRememberedEmail(email: string | null) {
  try {
    if (email) localStorage.setItem(KEY, email)
    else localStorage.removeItem(KEY)
  } catch {
    // best-effort — losing the remembered email just means retyping it next time
  }
}
