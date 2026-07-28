import type { Case, CaseStatus, CaseTimelineEvent, CaseImplantUsage } from '@/types'
import { patients } from './patients'
import { labs } from './labs'
import { products } from './products'
import { DOCTORS } from './names'
import { ri, pick, chance, iso, daysAgo, pad } from './rng'

const PROCEDURES = [
  'Single Tooth Implant',
  'Implant-Supported Bridge',
  'All-on-4 Full Arch Rehabilitation',
  'Sinus Lift + Delayed Implant',
  'Implant-Supported Overdenture',
  'Bone Graft + Staged Implant',
  'Immediate Implant Placement',
]

const FIXTURES = products.filter((p) => p.category === 'Implant Fixture')
// Simplified realistic FDI-like pool
const FDI_TEETH = ['11', '12', '13', '14', '15', '16', '21', '22', '23', '24', '25', '26', '31', '32', '33', '34', '35', '36', '41', '42', '43', '44', '45', '46']

const STATUS_WEIGHTS: { status: CaseStatus; weight: number }[] = [
  { status: 'planning', weight: 15 },
  { status: 'surgery-scheduled', weight: 12 },
  { status: 'in-progress', weight: 10 },
  { status: 'restoration', weight: 15 },
  { status: 'completed', weight: 42 },
  { status: 'cancelled', weight: 6 },
]

function weightedStatus(): CaseStatus {
  const total = STATUS_WEIGHTS.reduce((s, c) => s + c.weight, 0)
  let r = ri(1, total)
  for (const c of STATUS_WEIGHTS) {
    r -= c.weight
    if (r <= 0) return c.status
  }
  return 'planning'
}

let counter2025 = 0
let counter2026 = 0

function nextCaseId(createdAt: Date) {
  const year = createdAt.getFullYear()
  if (year <= 2025) {
    counter2025 += 1
    return { caseId: `IDC-2025-${pad(counter2025, 5)}`, year: 2025 }
  }
  counter2026 += 1
  return { caseId: `IDC-2026-${pad(counter2026, 5)}`, year: 2026 }
}

function timelineFor(caseIdInternal: string, status: CaseStatus, createdAt: Date, doctor: string): CaseTimelineEvent[] {
  const events: CaseTimelineEvent[] = []
  const push = (label: string, description: string, offsetDays: number, actor = doctor) => {
    const d = new Date(createdAt)
    d.setDate(d.getDate() + offsetDays)
    events.push({
      id: `${caseIdInternal}_evt_${events.length + 1}`,
      caseId: caseIdInternal,
      label,
      description,
      date: iso(d),
      actor,
    })
  }

  push('Case Opened', 'Treatment plan created and case opened for patient.', 0)
  if (status === 'cancelled') {
    push('Case Cancelled', 'Case was cancelled at patient or clinical request.', ri(3, 30))
    return events
  }
  push('Consultation & Imaging', 'CBCT scan and clinical exam completed; treatment plan finalized.', ri(1, 5))
  if (status === 'planning') return events

  push('Surgery Scheduled', 'Surgical appointment booked with patient.', ri(6, 14))
  if (status === 'surgery-scheduled') return events

  push('Implant Placement', 'Implant fixture(s) placed under local anesthesia.', ri(15, 21))
  if (status === 'in-progress') return events

  push('Healing Check', 'Osseointegration progressing as expected; healing abutment placed.', ri(60, 90))
  push('Final Impression', 'Digital/physical impression taken for final restoration.', ri(95, 110))
  if (status === 'restoration') return events

  push('Restoration Delivered', 'Final crown/prosthesis seated and occlusion verified.', ri(115, 135))
  return events
}

export const cases: Case[] = []
const caseImplantUsageIndex: { caseId: string; usage: CaseImplantUsage }[] = []

patients.forEach((patient) => {
  const caseCount = chance(0.15) ? 1 : chance(0.6) ? 2 : 3
  for (let c = 0; c < caseCount; c++) {
    const createdAt = daysAgo(ri(5, 640))
    const { caseId } = nextCaseId(createdAt)
    const status = weightedStatus()
    const doctor = pick(DOCTORS)
    const lab = chance(0.7) ? pick(labs) : undefined
    const procedure = pick(PROCEDURES)
    const implantCount = procedure.includes('All-on-4') ? ri(4, 6) : procedure.includes('Bridge') ? ri(2, 3) : ri(1, 2)

    const implants: CaseImplantUsage[] = status === 'planning' || status === 'surgery-scheduled' || status === 'cancelled'
      ? []
      : Array.from({ length: implantCount }).map(() => ({
          productId: pick(FIXTURES).id,
          tooth: pick(FDI_TEETH),
          quantity: 1,
          batchLot: chance(0.6) ? `LOT-${ri(10000, 99999)}` : undefined,
        }))

    const internalId = `cse_${cases.length + 1}`
    const caseRecord: Case = {
      id: internalId,
      caseId,
      patientId: patient.id,
      doctor,
      labId: lab?.id,
      status,
      procedure,
      createdAt: iso(createdAt),
      scheduledDate: status !== 'planning' && status !== 'cancelled' ? iso(daysAgo(ri(-14, ri(400, 620)))) : undefined,
      completedDate: status === 'completed' ? iso(daysAgo(ri(0, 400))) : undefined,
      implants,
      notes: chance(0.2) ? pick([
        'Patient tolerated procedure well, no complications.',
        'Delayed loading protocol selected due to bone density.',
        'Provisional restoration placed pending final impression.',
        'Coordinated with lab for custom shade matching.',
      ]) : undefined,
      history: timelineFor(internalId, status, createdAt, doctor),
    }
    cases.push(caseRecord)
    implants.forEach((usage) => caseImplantUsageIndex.push({ caseId: internalId, usage }))
  }
})

