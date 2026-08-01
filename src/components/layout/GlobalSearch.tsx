import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, Users, FolderKanban, FlaskConical, Truck, Receipt, HandCoins, ClipboardList } from 'lucide-react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { products, patients, cases, labs, vendors, sales, loans, purchaseOrders } = useData()
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

  const matchedVendors = useMemo(
    () => (q.length === 0 ? [] : vendors.filter((v) => v.name.toLowerCase().includes(q)).slice(0, 5)),
    [vendors, q],
  )

  const matchedSales = useMemo(
    () => (q.length === 0 ? [] : sales.filter((s) => s.saleNumber.toLowerCase().includes(q)).slice(0, 5)),
    [sales, q],
  )

  const matchedLoans = useMemo(
    () => (q.length === 0 ? [] : loans.filter((l) => l.loanNumber.toLowerCase().includes(q)).slice(0, 5)),
    [loans, q],
  )

  const matchedPOs = useMemo(
    () => (q.length === 0 ? [] : purchaseOrders.filter((po) => po.poNumber.toLowerCase().includes(q)).slice(0, 5)),
    [purchaseOrders, q],
  )

  const go = (path: string) => {
    navigate(path)
    onOpenChange(false)
  }

  const hasResults =
    matchedProducts.length +
      matchedPatients.length +
      matchedCases.length +
      matchedLabs.length +
      matchedVendors.length +
      matchedSales.length +
      matchedLoans.length +
      matchedPOs.length >
    0

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search products, patients, cases, vendors, sales, loans, POs..." value={query} onValueChange={setQuery} />
      <CommandList>
        {!hasResults && <CommandEmpty>No results found.</CommandEmpty>}

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

        {matchedVendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {matchedVendors.map((v) => (
              <CommandItem key={v.id} value={`vendor-${v.id}`} onSelect={() => go(`/vendors/${v.id}`)}>
                <Truck className="text-muted-foreground" />
                <span>{v.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedSales.length > 0 && (
          <CommandGroup heading="Sales">
            {matchedSales.map((s) => (
              <CommandItem key={s.id} value={`sale-${s.id}`} onSelect={() => go(`/sales/${s.id}`)}>
                <Receipt className="text-muted-foreground" />
                <span>{s.saleNumber}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedLoans.length > 0 && (
          <CommandGroup heading="Loans">
            {matchedLoans.map((l) => (
              <CommandItem key={l.id} value={`loan-${l.id}`} onSelect={() => go(`/loans/${l.id}`)}>
                <HandCoins className="text-muted-foreground" />
                <span>{l.loanNumber}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchedPOs.length > 0 && (
          <CommandGroup heading="Purchase Orders">
            {matchedPOs.map((po) => (
              <CommandItem key={po.id} value={`po-${po.id}`} onSelect={() => go(`/purchase-orders/${po.id}`)}>
                <ClipboardList className="text-muted-foreground" />
                <span>{po.poNumber}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
