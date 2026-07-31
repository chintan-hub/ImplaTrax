import { Package, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useData } from '@/store/DataContext'
import type { Product } from '@/types'
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat'
import { stockStatus, availableStock } from '@/lib/stock'

export function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const { clinicSettings } = useData()
  const { format } = useCurrencyFormat()
  const status = stockStatus(product)
  return (
    <Card onClick={onClick} className="cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${product.imageColor}1a`, color: product.imageColor }}
          >
            <Package className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-end gap-1">
            {product.status === 'discontinued' && <Badge variant="secondary">Discontinued</Badge>}
            {status !== 'normal' && product.status === 'active' && (
              <Badge variant={status === 'out' ? 'danger' : 'warning'}>
                {status === 'out' ? 'Out of stock' : 'Low stock'}
              </Badge>
            )}
            {clinicSettings.batchLotTrackingEnabled && product.batchTracked && (
              <Badge variant="outline" className="gap-1">
                <Layers className="h-3 w-3" /> Batch
              </Badge>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm font-medium leading-snug line-clamp-2">{product.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{product.sku}</p>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{product.manufacturer}</span>
          <span>{product.category}</span>
        </div>

        <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="text-lg font-semibold tabular-nums">{product.quantityOnHand}</p>
            <p className="text-[11px] text-muted-foreground">
              in stock{product.quantityReserved > 0 ? ` · ${availableStock(product)} available` : ''}
            </p>
          </div>
          {product.priceVisible && (
            <p className="text-sm font-medium tabular-nums">{format(product.unitPrice)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
