import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useSettingsHeaderAction } from './SettingsHeaderActionContext'

/**
 * Rendered in the Settings page's sticky header `actions` slot. Hidden
 * until the active tab reports unsaved changes, then fades and slides in;
 * reverting every field back to its saved value (or a successful save)
 * makes it fade back out — the same enter/exit transition either way,
 * since both are just `isDirty` becoming false.
 */
export function SettingsSaveAction() {
  const action = useSettingsHeaderAction()

  return (
    <AnimatePresence>
      {action?.isDirty && (
        <motion.div
          key="settings-save"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex items-center gap-3"
        >
          <span className="text-xs font-medium text-muted-foreground">Unsaved changes</span>
          <Button onClick={action.onSave} loading={action.saving}>
            Save Changes
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
