import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'
import type { Manufacturer, ProductCategory } from '@/types'

const MANUFACTURERS: Manufacturer[] = ['Straumann', 'Nobel Biocare', 'Osstem', 'NeoBiotech', 'Dentium', 'MIS']
const CATEGORIES: ProductCategory[] = [
  'Implant Fixture', 'Healing Abutment', 'Final Abutment', 'Cover Screw', 'Impression Coping',
  'Analog', 'Surgical Kit', 'Bone Graft Material', 'Membrane', 'Prosthetic Screw',
]

const schema = z.object({
  name: z.string().min(3, 'Name is required'),
  manufacturer: z.enum(MANUFACTURERS as [Manufacturer, ...Manufacturer[]]),
  category: z.enum(CATEGORIES as [ProductCategory, ...ProductCategory[]]),
  system: z.string().min(1, 'System is required'),
  diameterMm: z.coerce.number().optional(),
  lengthMm: z.coerce.number().optional(),
  platform: z.string().optional(),
  unitCost: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  quantityOnHand: z.coerce.number().min(0),
  lowStockThreshold: z.coerce.number().min(0),
  priceVisible: z.boolean(),
  batchTracked: z.boolean(),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ProductFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addProduct, vendors, clinicSettings } = useData()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      manufacturer: 'Straumann',
      category: 'Implant Fixture',
      priceVisible: true,
      batchTracked: false,
      quantityOnHand: 0,
      lowStockThreshold: 10,
      unitCost: 0,
      unitPrice: 0,
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    await simulateLatency()
    const vendor = vendors.find((v) => v.manufacturers.includes(values.manufacturer)) ?? vendors[0]
    addProduct({
      name: values.name,
      manufacturer: values.manufacturer,
      category: values.category,
      system: values.system,
      diameterMm: values.diameterMm,
      lengthMm: values.lengthMm,
      platform: values.platform,
      unitCost: values.unitCost,
      unitPrice: values.unitPrice,
      priceVisible: values.priceVisible,
      quantityOnHand: values.quantityOnHand,
      quantityReserved: 0,
      lowStockThreshold: values.lowStockThreshold,
      batchTracked: values.batchTracked,
      vendorId: vendor.id,
      imageColor: '#3b82f6',
      description: values.description ?? '',
      status: 'active',
    })
    toast.success('Product created', { description: `${values.name} was added to the catalog.` })
    setSubmitting(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quick Add Product</DialogTitle>
          <DialogDescription>Barcode and QR code are generated automatically on save.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" placeholder="e.g. Straumann BLX Implant Ø4.0mm × 10mm" {...register('name')} />
            {errors.name && <p className="text-xs text-danger-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Controller
              control={control}
              name="manufacturer"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MANUFACTURERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="system">System</Label>
            <Input id="system" placeholder="e.g. BLX" {...register('system')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="platform">Platform</Label>
            <Input id="platform" placeholder="e.g. RC" {...register('platform')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="diameterMm">Diameter (mm)</Label>
            <Input id="diameterMm" type="number" step="0.05" {...register('diameterMm')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lengthMm">Length (mm)</Label>
            <Input id="lengthMm" type="number" step="0.5" {...register('lengthMm')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unitCost">Purchase Price</Label>
            <Input id="unitCost" type="number" step="0.01" {...register('unitCost')} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.purchasePrice}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unitPrice">Selling Price</Label>
            <Input id="unitPrice" type="number" step="0.01" {...register('unitPrice')} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.sellingPrice}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantityOnHand">Initial quantity</Label>
            <Input id="quantityOnHand" type="number" {...register('quantityOnHand')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lowStockThreshold" className="flex items-center gap-1">
              Minimum Stock <TermHint term="lowStock" iconOnly />
            </Label>
            <Input id="lowStockThreshold" type="number" {...register('lowStockThreshold')} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.minStock}</p>
          </div>

          <div className="col-span-1 sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Price visible to staff</p>
              <p className="text-xs text-muted-foreground">{MICROCOPY.priceVisible}</p>
            </div>
            <Controller control={control} name="priceVisible" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>

          {clinicSettings.batchLotTrackingEnabled && (
            <div className="col-span-1 sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="flex items-center gap-1 text-sm font-medium">
                  Batch / lot tracking <TermHint term="batchNumber" iconOnly />
                </p>
                <p className="text-xs text-muted-foreground">{MICROCOPY.batchTracked}</p>
              </div>
              <Controller control={control} name="batchTracked" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </div>
          )}

          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register('description')} />
          </div>

          <DialogFooter className="col-span-1 sm:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" loading={submitting}>Create Product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
