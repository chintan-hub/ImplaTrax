import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'

export function LabFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addLab } = useData()
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', address: '' })
  const [submitting, setSubmitting] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Lab name is required.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    addLab({ ...form, specialties: [], rating: 4, turnaroundDays: 10 })
    toast.success(`Lab "${form.name}" added`, { description: 'It now appears in your lab directory.' })
    setSubmitting(false)
    setForm({ name: '', contactName: '', email: '', phone: '', address: '' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Lab</DialogTitle>
          <DialogDescription>Add a new dental lab to your directory.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="lab-name">Lab name</Label>
            <Input id="lab-name" value={form.name} onChange={set('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-contact">Contact name</Label>
            <Input id="lab-contact" value={form.contactName} onChange={set('contactName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lab-email">Email</Label>
            <Input id="lab-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="lab-phone">Phone</Label>
            <Input id="lab-phone" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="lab-address">Address</Label>
            <Input id="lab-address" value={form.address} onChange={set('address')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Add Lab</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
