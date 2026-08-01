import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { KeyboardShortcutsProvider, useKeyboardShortcut } from './useKeyboardShortcuts'

function fireKeydown(key: string, opts: Partial<KeyboardEventInit> = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}

function Consumer({ onK, onEscape }: { onK: () => void; onEscape: () => void }) {
  useKeyboardShortcut({ key: 'k', mod: true, handler: onK })
  useKeyboardShortcut({ key: 'Escape', handler: onEscape })
  return null
}

describe('useKeyboardShortcut', () => {
  it('fires a mod-based shortcut only when the modifier is held', () => {
    const onK = vi.fn()
    const onEscape = vi.fn()
    render(
      <KeyboardShortcutsProvider>
        <Consumer onK={onK} onEscape={onEscape} />
      </KeyboardShortcutsProvider>,
    )

    fireKeydown('k') // no modifier — should not fire
    expect(onK).not.toHaveBeenCalled()

    fireKeydown('k', { metaKey: true })
    expect(onK).toHaveBeenCalledTimes(1)
  })

  it('fires a bare-key shortcut with no modifier held', () => {
    const onK = vi.fn()
    const onEscape = vi.fn()
    render(
      <KeyboardShortcutsProvider>
        <Consumer onK={onK} onEscape={onEscape} />
      </KeyboardShortcutsProvider>,
    )

    fireKeydown('Escape')
    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('unregisters its shortcut on unmount', () => {
    const onK = vi.fn()
    const onEscape = vi.fn()
    const { unmount } = render(
      <KeyboardShortcutsProvider>
        <Consumer onK={onK} onEscape={onEscape} />
      </KeyboardShortcutsProvider>,
    )
    unmount()

    fireKeydown('k', { metaKey: true })
    expect(onK).not.toHaveBeenCalled()
  })
})
