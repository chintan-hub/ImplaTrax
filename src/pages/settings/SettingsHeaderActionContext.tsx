import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface SettingsSaveAction {
  isDirty: boolean
  saving: boolean
  onSave: () => void
}

interface SettingsHeaderActionContextValue {
  action: SettingsSaveAction | null
  setAction: (action: SettingsSaveAction | null) => void
}

const SettingsHeaderActionContext = createContext<SettingsHeaderActionContextValue | null>(null)

/** Wraps the Settings page so its sticky header can surface whichever tab's Save action is currently active. */
export function SettingsHeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<SettingsSaveAction | null>(null)
  return <SettingsHeaderActionContext.Provider value={{ action, setAction }}>{children}</SettingsHeaderActionContext.Provider>
}

/** Read by the Settings page header to render the active tab's Save button, if it has one. */
export function useSettingsHeaderAction() {
  const ctx = useContext(SettingsHeaderActionContext)
  if (!ctx) throw new Error('useSettingsHeaderAction must be used within SettingsHeaderActionProvider')
  return ctx.action
}

/**
 * Called by an editable Settings tab (Clinic, Profile, Workspace) to surface
 * its Save button in the page's sticky header instead of at the bottom of a
 * potentially long tab. Tabs the user has to scroll past several cards to
 * reach are exactly the case a sticky header exists for.
 *
 * Only one tab is ever mounted at a time — Radix unmounts inactive
 * `TabsContent` by default — so there's no ambiguity about whose action is
 * "current"; switching tabs unmounts the old one (clearing its action) and
 * mounts the new one (registering its own, or none for read-only tabs like
 * Security/Sessions/Activity/About).
 */
export function useRegisterSettingsSaveAction(action: SettingsSaveAction) {
  const ctx = useContext(SettingsHeaderActionContext)
  if (!ctx) throw new Error('useRegisterSettingsSaveAction must be used within SettingsHeaderActionProvider')
  const { setAction } = ctx
  useEffect(() => {
    setAction(action)
    return () => setAction(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.isDirty, action.saving, action.onSave, setAction])
}
