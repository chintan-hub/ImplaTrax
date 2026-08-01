import { useSearchParams } from 'react-router-dom'
import { StickyActionHeader } from '@/components/shared/StickyActionHeader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PAGE_INTROS } from '@/content/helpText'
import { SettingsHeaderActionProvider } from './SettingsHeaderActionContext'
import { SettingsSaveAction } from './SettingsSaveAction'
import { ClinicTab } from './tabs/ClinicTab'
import { ProfileTab } from './tabs/ProfileTab'
import { SecurityTab } from './tabs/SecurityTab'
import { WorkspaceTab } from './tabs/WorkspaceTab'
import { SessionsTab } from './tabs/SessionsTab'
import { ActivityLogTab } from './tabs/ActivityLogTab'
import { AboutTab } from './tabs/AboutTab'

const TABS = ['clinic', 'profile', 'security', 'workspace', 'sessions', 'activity', 'about'] as const
type SettingsTab = (typeof TABS)[number]

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = TABS.includes(tabParam as SettingsTab) ? (tabParam as SettingsTab) : 'clinic'

  const handleTabChange = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', value)
      return next
    })
  }

  return (
    <SettingsHeaderActionProvider>
      <div className="max-w-3xl">
        <StickyActionHeader
          title={PAGE_INTROS.settings.title}
          description={PAGE_INTROS.settings.description}
          actions={<SettingsSaveAction />}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-2 flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="clinic" className="data-[state=active]:bg-muted">Clinic</TabsTrigger>
            <TabsTrigger value="profile" className="data-[state=active]:bg-muted">Profile</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-muted">Security</TabsTrigger>
            <TabsTrigger value="workspace" className="data-[state=active]:bg-muted">Workspace</TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-muted">Sessions & Devices</TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-muted">Activity Log</TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-muted">About</TabsTrigger>
          </TabsList>

          <TabsContent value="clinic"><ClinicTab /></TabsContent>
          <TabsContent value="profile"><ProfileTab /></TabsContent>
          <TabsContent value="security"><SecurityTab /></TabsContent>
          <TabsContent value="workspace"><WorkspaceTab /></TabsContent>
          <TabsContent value="sessions"><SessionsTab /></TabsContent>
          <TabsContent value="activity"><ActivityLogTab /></TabsContent>
          <TabsContent value="about"><AboutTab /></TabsContent>
        </Tabs>
      </div>
    </SettingsHeaderActionProvider>
  )
}
