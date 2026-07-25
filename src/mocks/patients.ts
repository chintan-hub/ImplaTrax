import type { Patient } from '@/types'
import { FIRST_NAMES, LAST_NAMES, DOCTORS } from './names'
import { ri, pick, chance, iso, daysAgo, pad } from './rng'

function dobFor(age: number) {
  const year = new Date().getFullYear() - age
  const month = ri(0, 11)
  const day = ri(1, 28)
  return iso(new Date(year, month, day))
}

export const patients: Patient[] = Array.from({ length: 40 }).map((_, i) => {
  const sex: Patient['sex'] = chance(0.5) ? 'female' : 'male'
  const firstName = pick(FIRST_NAMES)
  const lastName = pick(LAST_NAMES)
  return {
    id: `pat_${i + 1}`,
    patientCode: `PT-${pad(1000 + i + 1, 5)}`,
    firstName,
    lastName,
    dob: dobFor(ri(19, 78)),
    sex,
    phone: `+1 (${ri(200, 989)}) ${ri(200, 989)}-${ri(1000, 9999)}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@mail.com`,
    primaryDoctor: pick(DOCTORS),
    createdAt: iso(daysAgo(ri(20, 1000))),
    notes: chance(0.15) ? pick([
      'Controlled Type 2 diabetes — monitor healing closely.',
      'Prior sinus lift, healed well.',
      'On anticoagulant therapy — coordinate with physician before surgery.',
      'Bruxism — nightguard recommended post-restoration.',
      'Smoker — advised on increased implant failure risk.',
    ]) : undefined,
  }
})

export function patientFullName(p: Patient) {
  return `${p.firstName} ${p.lastName}`
}
