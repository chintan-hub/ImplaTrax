import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { KeyboardShortcutsProvider, useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts'

function AppLayoutContent() {
  const [searchOpen, setSearchOpen] = useState(false)

  useKeyboardShortcut({
    key: 'k',
    mod: true,
    handler: (e) => {
      e.preventDefault()
      setSearchOpen((v) => !v)
    },
  })

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground print:h-auto print:overflow-visible">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
          <Topbar onOpenSearch={() => setSearchOpen(true)} />
          <main className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible">
            <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

export function AppLayout() {
  return (
    <KeyboardShortcutsProvider>
      <AppLayoutContent />
    </KeyboardShortcutsProvider>
  )
}
