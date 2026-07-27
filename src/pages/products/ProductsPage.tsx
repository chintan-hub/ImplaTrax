import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { LayoutGrid, List, Plus, ArrowUpDown, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductCard } from '@/components/products/ProductCard'
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import { ProductDetailSheet } from '@/components/products/ProductDetailSheet'
import { IconHelp } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { formatCurrency, cn } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import type { Product, Manufacturer, ProductCategory } from '@/types'

const MANUFACTURERS: Manufacturer[] = ['Straumann', 'Nobel Biocare', 'Osstem', 'NeoBiotech', 'Dentium', 'MIS']
const CATEGORIES: ProductCategory[] = [
  'Implant Fixture', 'Healing Abutment', 'Final Abutment', 'Cover Screw', 'Impression Coping',
  'Analog', 'Surgical Kit', 'Bone Graft Material', 'Membrane', 'Prosthetic Screw',
]

const columnHelper = createColumnHelper<Product>()

export function ProductsPage() {
  const { products } = useData()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'card' | 'table'>('card')
  const [search, setSearch] = useState('')
  const [manufacturer, setManufacturer] = useState<string>('all')
  const [category, setCategory] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sorting, setSorting] = useState<SortingState>([])

  const highlightId = params.get('highlight')
  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q))) return false
      if (manufacturer !== 'all' && p.manufacturer !== manufacturer) return false
      if (category !== 'all' && p.category !== category) return false
      if (stockFilter === 'low' && p.quantityOnHand > p.lowStockThreshold) return false
      if (stockFilter === 'out' && p.quantityOnHand !== 0) return false
      return true
    })
  }, [products, search, manufacturer, category, stockFilter])

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Product',
        cell: (info) => (
          <div>
            <p className="font-medium">{info.getValue()}</p>
            <p className="text-xs text-muted-foreground">{info.row.original.sku}</p>
          </div>
        ),
      }),
      columnHelper.accessor('manufacturer', { header: 'Manufacturer' }),
      columnHelper.accessor('category', { header: 'Category' }),
      columnHelper.accessor('quantityOnHand', {
        header: () => <span className="block text-right">On hand</span>,
        cell: (info) => {
          const p = info.row.original
          const low = p.quantityOnHand <= p.lowStockThreshold
          return (
            <span className={cn('block text-right tabular-nums font-medium', low && 'text-warning-700 dark:text-warning-500')}>
              {info.getValue()}
            </span>
          )
        },
      }),
      columnHelper.accessor('unitPrice', {
        header: () => <span className="block text-right">Price</span>,
        cell: (info) => (
          <span className="block text-right tabular-nums">
            {info.row.original.priceVisible ? formatCurrency(info.getValue()) : '—'}
          </span>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => <Badge variant={info.getValue() === 'active' ? 'success' : 'secondary'}>{info.getValue()}</Badge>,
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.products.title}
        description={`${PAGE_INTROS.products.description} ${products.length} products across ${MANUFACTURERS.length} manufacturers.`}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as 'card' | 'table')}>
              <TabsList>
                <IconHelp helpKey="cardView">
                  <TabsTrigger value="card" aria-label="Card view"><LayoutGrid className="h-3.5 w-3.5" /></TabsTrigger>
                </IconHelp>
                <IconHelp helpKey="tableView">
                  <TabsTrigger value="table" aria-label="Table view"><List className="h-3.5 w-3.5" /></TabsTrigger>
                </IconHelp>
              </TabsList>
            </Tabs>
            <IconHelp helpKey="quickAdd">
              <Button
                onClick={() => {
                  setFormOpen(true)
                  params.delete('new')
                  setParams(params, { replace: true })
                }}
                aria-label="Quick add a new product"
              >
                <Plus className="h-4 w-4" /> Quick Add
              </Button>
            </IconHelp>
          </>
        }
      />

      <StickyToolbar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, SKU, barcode..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={manufacturer} onValueChange={setManufacturer}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Manufacturer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All manufacturers</SelectItem>
            {MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stock" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low">Low stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.products.title}
          description={EMPTY_STATES.products.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.products.actionLabel}
            </Button>
          }
        />
      ) : view === 'card' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className={p.id === highlightId ? 'ring-2 ring-primary rounded-xl' : ''}>
              <ProductCard product={p} onClick={() => setSelectedId(p.id)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="cursor-pointer select-none" onClick={header.column.getToggleSortingHandler()}>
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-40" />}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.original.id)}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <ProductDetailSheet product={selected} open={!!selected} onOpenChange={(v) => !v && setSelectedId(null)} />
    </div>
  )
}
