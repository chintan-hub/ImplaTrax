import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'
import type { Lab } from '@/types'

const EMPTY_FORM = { name: '', contactName: '', email: '', phone: '', address: '' }

export function LabFormDialog({ open, onOpenChange, lab }: { open: boolean; onOpenChange: (v: boolean) => void; lab?: Lab }) {
  const { addLab, updateLab } = useData()
  const isEdit = !!lab
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setForm(lab ? { name: lab.name, contactName: lab.contactName, email: lab.email, phone: lab.phone, address: lab.address } : EMPTY_FORM)
  }, [open, lab])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Lab name is required.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    try {
      if (isEdit && lab) {
        updateLab(lab.id, form)
        toast.success(`Lab "${form.name}" updated`)
      } else {
        addLab({ ...form, specialties: [], rating: 4, turnaroundDays: 10 })
        toast.success(`Lab "${form.name}" added`, { description: 'It now appears in your lab directory.' })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(isEdit ? 'Could not update lab' : 'Could not add lab', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lab' : 'Add Lab'}</DialogTitle>
          <DialogDescription>{isEdit ? "Update this lab's details." : 'Add a new dental lab to your directory.'}</DialogDescription>
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
          <Button onClick={handleSubmit} loading={submitting}>{isEdit ? 'Save Changes' : 'Add Lab'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
