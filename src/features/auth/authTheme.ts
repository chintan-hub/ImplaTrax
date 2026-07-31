/**
 * Single source of truth for the visual language shared by every auth
 * screen (LoginScreen + every OnboardingFlow step). Centralizing these as
 * constants — rather than repeating near-identical class strings in each
 * screen — is what actually guarantees the screens stay pixel-consistent
 * as this flow evolves: there's only one place a spacing/surface/motion
 * value can drift out of sync.
 */

/** A soft radial "light source" from the top instead of a flat fill — the "richer background" the redesign asked for. Reuses existing --background/--primary tokens, no new palette. */
export const AUTH_BACKDROP_CLASS =
  'bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,hsl(var(--primary)/0.07),hsl(var(--background))_70%)] ' +
  'dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,hsl(var(--primary)/0.16),hsl(var(--background))_70%)]'

/** The elevated glass-card surface every screen's content sits inside. */
export const AUTH_CARD_CLASS =
  'rounded-2xl border border-border/50 bg-muted/60 shadow-elevated backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]'

/** Premium "expo-out" deceleration — snappier start, soft landing. Used for every screen/step transition so motion feels like one system. */
export const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const

export const STEP_TRANSITION = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
  transition: { duration: 0.35, ease: PREMIUM_EASE },
}

/** Taller, slightly more elevated CTA with a confident hover lift — scoped to this flow via className overrides; the shared Button component (used app-wide) is untouched. */
export const CTA_BUTTON_CLASS =
  'h-12 rounded-xl shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-sm ' +
  'bg-gradient-to-b from-primary to-primary-800 hover:from-primary-hover hover:to-primary-800'

/** Scoped Input treatment for the onboarding form — taller, and given its own surface fill so it doesn't blend into the glass card behind it (the same problem the keypad had). */
export const AUTH_INPUT_CLASS = 'h-11 border-border/70 bg-background/60 dark:bg-black/20 focus-visible:ring-primary'
