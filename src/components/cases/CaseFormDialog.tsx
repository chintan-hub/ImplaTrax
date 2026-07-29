import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { DoctorCombobox } from '@/components/shared/DoctorCombobox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'
import type { CaseStatus } from '@/types'

const PROCEDURES = [
  'Single Tooth Implant', 'Implant-Supported Bridge', 'All-on-4 Full Arch Rehabilitation',
  'Sinus Lift + Delayed Implant', 'Implant-Supported Overdenture', 'Bone Graft + Staged Implant', 'Immediate Implant Placement',
]

export function CaseFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { patients, labs, addCase } = useData()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const presetPatientId = params.get('patientId') ?? ''

  const [patientId, setPatientId] = useState(presetPatientId)
  const [doctor, setDoctor] = useState<string>('')
  const [labId, setLabId] = useState<string>('none')
  const [procedure, setProcedure] = useState(PROCEDURES[0])
  const [status, setStatus] = useState<CaseStatus>('planning')
  const [scheduledDate, setScheduledDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!patientId) {
      toast.error('Select a patient.')
      return
    }
    if (!doctor.trim()) {
      toast.error('Select or add a doctor.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    const record = addCase({
      patientId,
      doctor,
      labId: labId === 'none' ? undefined : labId,
      status,
      procedure,
      scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
    })
    toast.success(`Case ${record.caseId} created`, { description: 'Opening the case timeline...' })
    setSubmitting(false)
    onOpenChange(false)
    navigate(`/cases/${record.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Case</DialogTitle>
          <DialogDescription>{MICROCOPY.caseId} For example, IDC-2026-00001.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label>Patient</Label>
            <Combobox
              options={patients.map((p) => ({ value: p.id, label: `${patientFullName(p)} · ${p.patientCode}` }))}
              value={patientId}
              onChange={setPatientId}
              placeholder="Select patient"
              searchPlaceholder="Search patients..."
              emptyText="No patients found."
              triggerAriaLabel="Patient"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Doctor</Label>
            <DoctorCombobox value={doctor} onChange={setDoctor} />
          </div>
          <div className="space-y-1.5">
            <Label>Lab (optional)</Label>
            <Combobox
              options={[{ value: 'none', label: 'No lab' }, ...labs.map((l) => ({ value: l.id, label: l.name }))]}
              value={labId}
              onChange={setLabId}
              placeholder="Select lab"
              searchPlaceholder="Search labs..."
              emptyText="No labs found."
              triggerAriaLabel="Lab"
            />
          </div>
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label>Procedure</Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROCEDURES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as CaseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="surgery-scheduled">Surgery Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Scheduled date</Label>
            <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Create Case</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
