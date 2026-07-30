import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'

export interface ShortcutBinding {
  /** The key as reported by KeyboardEvent.key, e.g. 'k', 'Escape'. Case-insensitive. */
  key: string
  /** Requires Cmd (Mac) or Ctrl (Windows/Linux) to be held. Omit for a bare key that must fire with no modifier held. */
  mod?: boolean
  handler: (e: KeyboardEvent) => void
}

interface ShortcutsContextValue {
  register: (binding: ShortcutBinding) => () => void
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

/**
 * Single registration point for every keyboard shortcut in the app — one
 * `keydown` listener here, everything else registers into it via
 * `useKeyboardShortcut` instead of adding its own `window.addEventListener`
 * (P4-D: replaces the one-off ⌘K listener that used to live in AppLayout).
 */
export function KeyboardShortcutsProvider({ children }: { children: ReactNode }) {
  const bindingsRef = useRef(new Set<ShortcutBinding>())

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const modHeld = e.metaKey || e.ctrlKey
      for (const binding of bindingsRef.current) {
        if (isTyping && !binding.mod) continue // bare-key shortcuts never hijack typing; mod-based ones (⌘K) still fire
        if (e.key.toLowerCase() !== binding.key.toLowerCase()) continue
        if (binding.mod ? !modHeld : modHeld) continue
        binding.handler(e)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const register = (binding: ShortcutBinding) => {
    bindingsRef.current.add(binding)
    return () => {
      bindingsRef.current.delete(binding)
    }
  }

  return <ShortcutsContext.Provider value={{ register }}>{children}</ShortcutsContext.Provider>
}

export function useKeyboardShortcut(binding: ShortcutBinding) {
  const ctx = useContext(ShortcutsContext)
  const handlerRef = useRef(binding.handler)
  handlerRef.current = binding.handler

  useEffect(() => {
    if (!ctx) return
    return ctx.register({ key: binding.key, mod: binding.mod, handler: (e) => handlerRef.current(e) })
  }, [ctx, binding.key, binding.mod])
}
