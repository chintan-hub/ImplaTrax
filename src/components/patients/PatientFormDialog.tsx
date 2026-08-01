import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { DoctorCombobox } from '@/components/shared/DoctorCombobox'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'
import type { Patient } from '@/types'

const EMPTY_FORM = { firstName: '', lastName: '', dob: '', phone: '', email: '', notes: '' }

function editForm(patient: Patient) {
  return { firstName: patient.firstName, lastName: patient.lastName, dob: patient.dob, phone: patient.phone, email: patient.email, notes: patient.notes ?? '' }
}

export function PatientFormDialog({
  open,
  onOpenChange,
  patient,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  patient?: Patient
  /** When set, a newly created patient is handed back here instead of navigating to their profile — used to keep the caller (e.g. Case creation) in its own flow. */
  onCreated?: (patient: Patient) => void
}) {
  const { addPatient, updatePatient } = useData()
  const navigate = useNavigate()
  const isEdit = !!patient
  const [form, setForm] = useState(EMPTY_FORM)
  const [sex, setSex] = useState<'male' | 'female'>('female')
  const [doctor, setDoctor] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(patient ? editForm(patient) : EMPTY_FORM)
      setSex(patient?.sex ?? 'female')
      setDoctor(patient?.primaryDoctor ?? '')
    }
  }, [open, patient])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((prev) => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required.')
      return
    }
    if (!form.dob) {
      toast.error('Date of birth is required.')
      return
    }
    if (!doctor.trim()) {
      toast.error('Select or add a primary doctor.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    if (isEdit && patient) {
      updatePatient(patient.id, { ...form, sex, primaryDoctor: doctor })
      toast.success(`${form.firstName} ${form.lastName} updated`)
      setSubmitting(false)
      onOpenChange(false)
    } else {
      const created = addPatient({ ...form, sex, primaryDoctor: doctor })
      setSubmitting(false)
      onOpenChange(false)
      if (onCreated) {
        toast.success(`Patient ${form.firstName} ${form.lastName} added`)
        onCreated(created)
      } else {
        toast.success(`Patient ${form.firstName} ${form.lastName} added`, { description: 'Opening their profile...' })
        navigate(`/patients/${created.id}`)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Patient' : 'Add Patient'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update this patient’s record.' : 'Create a new patient record.'}</DialogDescription>
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
            <DoctorCombobox value={doctor} onChange={setDoctor} />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label htmlFor="patient-notes">Notes</Label>
            <Textarea id="patient-notes" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>{isEdit ? 'Save Changes' : 'Add Patient'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
