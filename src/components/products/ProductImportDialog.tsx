import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, Download, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { useData } from '@/store/DataContext'
import { exportToCsv, parseCsv } from '@/lib/documents/csv'
import { validateImportRows, IMPORT_TEMPLATE_HEADERS, IMPORT_TEMPLATE_EXAMPLE_ROW, type ImportRowResult } from '@/lib/productImport'
import { simulateLatency } from '@/lib/utils'

export function ProductImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, importProducts } = useData()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)
  const [importing, setImporting] = useState(false)

  const validCount = results?.filter((r) => r.errors.length === 0).length ?? 0
  const invalidCount = results ? results.length - validCount : 0

  const reset = () => {
    setFileName(null)
    setResults(null)
    setImporting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result))
        if (parsed.length === 0) {
          toast.error('That file has no data rows to import.')
          setResults(null)
          return
        }
        setResults(validateImportRows(parsed, products))
      } catch {
        toast.error('Could not read that file as CSV.')
        setResults(null)
      }
    }
    reader.onerror = () => toast.error('Could not read that file.')
    reader.readAsText(file)
  }

  const handleDownloadTemplate = () => {
    exportToCsv([IMPORT_TEMPLATE_EXAMPLE_ROW], 'product-import-template.csv')
  }

  const handleConfirmImport = async () => {
    if (!results) return
    const validRows = results.filter((r) => r.errors.length === 0 && r.product)
    if (validRows.length === 0) return
    setImporting(true)
    await simulateLatency()
    const created = importProducts(validRows.map((r) => r.product!))
    toast.success(`${created.length} product${created.length !== 1 ? 's' : ''} imported`, {
      description: invalidCount > 0 ? `${invalidCount} row${invalidCount !== 1 ? 's' : ''} were skipped due to validation errors.` : undefined,
    })
    setImporting(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
          <DialogDescription>
            Upload a CSV of products. Every row is validated and shown below before anything is created — nothing is written until you confirm.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border py-12">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Choose a CSV file to import</p>
              <p className="mt-1 text-xs text-muted-foreground">Columns: {IMPORT_TEMPLATE_HEADERS.join(', ')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Download Template
              </Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Choose File
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelected} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{fileName} · {results.length} row{results.length !== 1 ? 's' : ''} parsed</p>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} ready</Badge>
                {invalidCount > 0 && <Badge variant="danger" className="gap-1"><XCircle className="h-3 w-3" /> {invalidCount} with errors</Badge>}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Row</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.raw['Product'] || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{r.raw['Manufacturer'] || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.raw['Qty On Hand'] || '—'}</TableCell>
                      <TableCell>
                        {r.errors.length > 0 ? (
                          <div className="flex items-start gap-1.5 text-danger-600">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs">{r.errors.join(' ')}</span>
                          </div>
                        ) : r.warnings.length > 0 ? (
                          <div className="flex items-start gap-1.5 text-warning-600">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs">{r.warnings.join(' ')}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-success-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="text-xs">Ready</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {results && (
            <Button variant="ghost" onClick={reset} disabled={importing}>Choose a Different File</Button>
          )}
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={importing}>Cancel</Button>
          {results && (
            <Button onClick={handleConfirmImport} loading={importing} disabled={validCount === 0}>
              Import {validCount} Product{validCount !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
