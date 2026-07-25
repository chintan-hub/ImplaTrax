import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'

export function VendorFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addVendor } = useData()
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', address: '', country: 'United States' })
  const [submitting, setSubmitting] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Vendor name is required.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    addVendor({ ...form, manufacturers: [] })
    toast.success(`Vendor "${form.name}" added`, { description: 'It now appears in your vendor directory.' })
    setSubmitting(false)
    setForm({ name: '', contactName: '', email: '', phone: '', address: '', country: 'United States' })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vendor</DialogTitle>
          <DialogDescription>Add a new vendor to your directory.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="vendor-name">Vendor name</Label>
            <Input id="vendor-name" value={form.name} onChange={set('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-contact">Contact name</Label>
            <Input id="vendor-contact" value={form.contactName} onChange={set('contactName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-email">Email</Label>
            <Input id="vendor-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input id="vendor-phone" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vendor-country">Country</Label>
            <Input id="vendor-country" value={form.country} onChange={set('country')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Input id="vendor-address" value={form.address} onChange={set('address')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Add Vendor</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
