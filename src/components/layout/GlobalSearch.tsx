import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Users, FolderKanban, FlaskConical, Barcode as BarcodeIcon, Plus, ClipboardList, HandCoins, Receipt } from 'lucide-react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'

// Mirrors Topbar.tsx's "New" dropdown exactly — the palette should never
// offer a different set of quick-create destinations than the button does.
const ACTIONS = [
  { id: 'new-product', label: 'New Product', path: '/products?new=1', icon: Package },
  { id: 'new-purchase-order', label: 'New Purchase Order', path: '/purchase-orders?new=1', icon: ClipboardList },
  { id: 'new-patient', label: 'New Patient', path: '/patients?new=1', icon: Users },
  { id: 'new-case', label: 'New Case', path: '/cases?new=1', icon: FolderKanban },
  { id: 'new-loan', label: 'New Loan', path: '/loans?new=1', icon: HandCoins },
  { id: 'new-sale', label: 'New Sale', path: '/sales?new=1', icon: Receipt },
] as const

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { products, patients, cases, labs } = useData()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const q = query.trim().toLowerCase()

  const matchedProducts = useMemo(
    () =>
      q.length === 0
        ? products.slice(0, 5)
        : products
            .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))
            .slice(0, 6),
    [products, q],
  )

  const matchedPatients = useMemo(
    () =>
      q.length === 0
        ? []
        : patients.filter((p) => patientFullName(p).toLowerCase().includes(q) || p.patientCode.toLowerCase().includes(q)).slice(0, 6),
    [patients, q],
  )

  const matchedCases = useMemo(
    () => (q.length === 0 ? [] : cases.filter((c) => c.caseId.toLowerCase().includes(q)).slice(0, 6)),
    [cases, q],
  )

  const matchedLabs = useMemo(
    () => (q.length === 0 ? [] : labs.filter((l) => l.name.toLowerCase().includes(q)).slice(0, 5)),
    [labs, q],
  )

  const matchedActions = useMemo(
    () => (q.length === 0 ? ACTIONS : ACTIONS.filter((a) => a.label.toLowerCase().includes(q))),
    [q],
  )

  const go = (path: string) => {
    navigate(path)
    onOpenChange(false)
  }

  const hasResults =
    matchedProducts.length + matchedPatients.length + matchedCases.length + matchedLabs.length + matchedActions.length > 0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search SKU, barcode, patient, case ID, product..." value={query} onValueChange={setQuery} />
      <CommandList>
        {!hasResults && <CommandEmpty>No results found.</CommandEmpty>}

        {matchedActions.length > 0 && (
          <CommandGroup heading="Actions">
            {matchedActions.map((a) => (
              <CommandItem key={a.id} value={a.id} onSelect={() => go(a.path)}>
                <Plus className="text-muted-foreground" />
                <span>{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedProducts.length > 0 && (
          <CommandGroup heading="Products">
            {matchedProducts.map((p) => (
              <CommandItem key={p.id} value={`product-${p.id}`} onSelect={() => go(`/products?highlight=${p.id}`)}>
                <Package className="text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.sku} · Barcode {p.barcode}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedPatients.length > 0 && (
          <CommandGroup heading="Patients">
            {matchedPatients.map((p) => (
              <CommandItem key={p.id} value={`patient-${p.id}`} onSelect={() => go(`/patients/${p.id}`)}>
                <Users className="text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{patientFullName(p)}</span>
                  <span className="text-xs text-muted-foreground">{p.patientCode}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedCases.length > 0 && (
          <CommandGroup heading="Cases">
            {matchedCases.map((c) => (
              <CommandItem key={c.id} value={`case-${c.id}`} onSelect={() => go(`/cases/${c.id}`)}>
                <FolderKanban className="text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{c.caseId}</span>
                  <span className="text-xs text-muted-foreground">{c.procedure}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedLabs.length > 0 && (
          <CommandGroup heading="Labs">
            {matchedLabs.map((l) => (
              <CommandItem key={l.id} value={`lab-${l.id}`} onSelect={() => go(`/labs/${l.id}`)}>
                <FlaskConical className="text-muted-foreground" />
                <span>{l.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {q.length > 0 && (
          <CommandGroup heading="Barcode lookup">
            <CommandItem value="barcode-hint" disabled>
              <BarcodeIcon className="text-muted-foreground" />
              <span className="text-muted-foreground">Scan or type a barcode to jump straight to a product</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
