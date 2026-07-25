import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { DOCTORS } from '@/mocks/names'
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
  const [doctor, setDoctor] = useState<string>(DOCTORS[0])
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
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{patientFullName(p)} · {p.patientCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Doctor</Label>
            <Select value={doctor} onValueChange={setDoctor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCTORS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Lab (optional)</Label>
            <Select value={labId} onValueChange={setLabId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">No lab</SelectItem>
                {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
