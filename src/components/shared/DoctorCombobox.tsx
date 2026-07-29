import { Combobox } from '@/components/ui/combobox'
import { useData } from '@/store/DataContext'

/**
 * Every Doctor field in the app renders through here — a searchable,
 * create-on-the-fly picker backed by the persisted `doctors` table
 * (PROJECT.md §3). Callers only ever see/store the "Dr. <name>" display
 * string, matching every existing Patient.primaryDoctor / Case.doctor value.
 */
export function DoctorCombobox({
  value,
  onChange,
  placeholder = 'Select or add doctor',
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const { doctors, addDoctor } = useData()

  const options = doctors
    .filter((d) => d.active)
    .map((d) => ({ value: `Dr. ${d.name}`, label: `Dr. ${d.name}`, searchValue: d.name }))

  const handleCreate = (typed: string) => {
    const name = typed.replace(/^Dr\.\s*/i, '').trim()
    if (!name) return
    const existing = doctors.find((d) => d.name.toLowerCase() === name.toLowerCase())
    const doctor = existing ?? addDoctor({ name })
    onChange(`Dr. ${doctor.name}`)
  }

  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      onCreate={handleCreate}
      createLabel={(typed) => `Add "Dr. ${typed.replace(/^Dr\.\s*/i, '').trim()}"`}
      placeholder={placeholder}
      searchPlaceholder="Search doctors..."
      emptyText="No doctors found."
      triggerAriaLabel="Doctor"
      disabled={disabled}
    />
  )
}
