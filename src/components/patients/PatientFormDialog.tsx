import { useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useData } from '@/store/DataContext'
import { DOCTORS } from '@/mocks/names'
import { simulateLatency } from '@/lib/utils'

export function PatientFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addPatient } = useData()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', dob: '', phone: '', email: '' })
  const [sex, setSex] = useState<'male' | 'female'>('female')
  const [doctor, setDoctor] = useState<string>(DOCTORS[0])
  const [submitting, setSubmitting] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required.')
      return
    }
    if (!form.dob) {
      toast.error('Date of birth is required.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    const patient = addPatient({ ...form, sex, primaryDoctor: doctor })
    toast.success(`Patient ${form.firstName} ${form.lastName} added`, { description: 'Opening their profile...' })
    setSubmitting(false)
    onOpenChange(false)
    navigate(`/patients/${patient.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Patient</DialogTitle>
          <DialogDescription>Create a new patient record.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="patient-first">First name</Label>
            <Input id="patient-first" value={form.firstName} onChange={set('firstName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-last">Last name</Label>
            <Input id="patient-last" value={form.lastName} onChange={set('lastName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-dob">Date of birth</Label>
            <Input id="patient-dob" type="date" value={form.dob} onChange={set('dob')} />
          </div>
          <div className="space-y-1.5">
            <Label>Sex</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as 'male' | 'female')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-phone">Phone</Label>
            <Input id="patient-phone" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="patient-email">Email</Label>
            <Input id="patient-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label>Primary doctor</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCTORS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Add Patient</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
