/**
 * Single source of truth for the visual language shared by every auth
 * screen (LoginScreen + every OnboardingFlow step). Centralizing these as
 * constants — rather than repeating near-identical class strings in each
 * screen — is what actually guarantees the screens stay pixel-consistent
 * as this flow evolves: there's only one place a spacing/surface/motion
 * value can drift out of sync.
 */

/**
 * Layered atmosphere, not a flat fill: a soft light source from above, a
 * gentle vignette pulling the corners darker so the eye has nowhere to go
 * but the card, and a faint secondary glow low in the frame so the card
 * feels like it's sitting *in* a lit environment rather than pasted on a
 * gradient swatch. Built entirely from existing --background/--primary
 * tokens — dark mode's glow is stronger since dark is the primary theme.
 */
// NOTE: each bg-[...]/dark:bg-[...] token below must stay as ONE unbroken
// string literal — splitting a multi-gradient arbitrary value across
// separate string-concatenation lines (mid-bracket) silently breaks
// Tailwind's static class extraction and the whole utility fails to
// generate any CSS at all, with no build error. Splitting BETWEEN two
// complete, already-bracket-balanced tokens (e.g. after the closing `]`) is
// fine — only splitting inside an unclosed bracket group is the problem.
export const AUTH_BACKDROP_CLASS =
  'bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(ellipse_60%_45%_at_50%_100%,hsl(var(--primary)/0.04),transparent_65%),radial-gradient(ellipse_120%_90%_at_50%_50%,hsl(var(--background)),hsl(var(--foreground)/0.05)_100%)] ' +
  'dark:bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,hsl(var(--primary)/0.20),transparent_60%),radial-gradient(ellipse_60%_45%_at_50%_100%,hsl(var(--primary)/0.10),transparent_65%),radial-gradient(ellipse_120%_90%_at_50%_50%,hsl(var(--background)),black_100%)]'

/**
 * The elevated glass-card surface every screen's content sits inside.
 * Depth comes from three things layered together: an inset top highlight
 * (as if lit from above, the same cue real glass/metal edges give), a
 * two-tier shadow (a tight contact shadow + a large soft ambient one, not
 * one flat blur), and a subtle top-to-bottom gradient instead of a single
 * flat fill so the surface itself reads as physical rather than a flat
 * rectangle with a border.
 */
export const AUTH_CARD_CLASS =
  'relative rounded-[28px] border border-white/70 bg-gradient-to-b from-white/75 to-white/45 backdrop-blur-2xl ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_0_0_1px_rgba(255,255,255,0.15),0_1px_2px_rgba(15,23,42,0.04),0_28px_60px_-20px_rgba(15,23,42,0.28)] ' +
  'dark:border-white/[0.09] dark:bg-gradient-to-b dark:from-white/[0.055] dark:to-white/[0.015] ' +
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_0_0_1px_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.4),0_40px_90px_-20px_rgba(0,0,0,0.7),0_0_70px_-25px_hsl(var(--primary)/0.3)]'

/**
 * Fixed dark teal/navy stage for the split-layout's decorative showcase
 * panel. Deliberately NOT theme-aware (no dark: variants) — it's a
 * consistent premium backdrop for the brand mark, not "the page in dark
 * mode," so it stays the same regardless of the user's light/dark toggle
 * (which continues to apply everywhere else, including the content panel).
 */
export const AUTH_SHOWCASE_BG_CLASS =
  'bg-[radial-gradient(ellipse_75%_55%_at_35%_18%,hsl(var(--primary)/0.35),transparent_60%),radial-gradient(ellipse_65%_50%_at_50%_100%,hsl(var(--primary)/0.14),transparent_65%),linear-gradient(165deg,#0a1a1f_0%,#071316_55%,#040a0b_100%)]'

/** Premium "expo-out" deceleration — snappier start, soft landing. Used for every screen/step transition so motion feels like one system. */
export const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const

export const STEP_TRANSITION = {
  initial: { opacity: 0, y: 10, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.99 },
  transition: { duration: 0.35, ease: PREMIUM_EASE },
}

/**
 * Confident primary CTA: a glossy inset highlight along the top edge (the
 * cue that sells "raised, pressable surface"), a colored ambient glow
 * instead of a plain gray shadow so it reads as the one thing on screen
 * asking for attention, a hover lift that brightens the glow, and a press
 * state that flattens back down with a tighter shadow. Scoped to this flow
 * via className overrides — the shared Button component (used app-wide)
 * is untouched.
 */
export const CTA_BUTTON_CLASS =
  'h-12 rounded-xl transition-all duration-200 ease-out ' +
  'bg-gradient-to-b from-primary to-primary-800 hover:from-primary-hover hover:to-primary-800 ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15),0_10px_24px_-8px_hsl(var(--primary)/0.55)] ' +
  'hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.15),0_16px_32px_-8px_hsl(var(--primary)/0.65)] ' +
  'active:translate-y-0 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]'

/**
 * Scoped Input treatment for the onboarding form — its own surface fill so
 * it doesn't blend into the glass card behind it (the same fix the keypad
 * needed), a hover state that hints it's interactive before it's even
 * focused, and a focus state with a real glow ring plus a border color
 * shift so the active field is unmistakable.
 */
export const AUTH_INPUT_CLASS =
  'h-11 border-border/70 bg-background/60 transition-all duration-150 ' +
  'hover:border-primary/40 ' +
  'focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:shadow-[0_0_0_1px_hsl(var(--primary))] ' +
  'dark:bg-black/25 dark:hover:border-primary/50'
