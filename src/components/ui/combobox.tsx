import * as React from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command'

export interface ComboboxOption {
  value: string
  label: string
  /** Used for search/exact-match matching instead of `label` when they differ (e.g. label carries a display prefix). */
  searchValue?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** When provided, typing a name with no exact match offers an inline "create" option. */
  onCreate?: (typed: string) => void
  createLabel?: (typed: string) => string
  className?: string
  disabled?: boolean
  triggerAriaLabel?: string
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  onCreate,
  createLabel = (typed) => `Add "${typed}"`,
  className,
  disabled,
  triggerAriaLabel,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selected = options.find((o) => o.value === value)
  const matchText = (o: ComboboxOption) => (o.searchValue ?? o.label).toLowerCase()
  const q = search.trim().toLowerCase()
  const filtered = q ? options.filter((o) => matchText(o).includes(q)) : options
  const exactMatch = options.some((o) => matchText(o) === q)
  const canCreate = !!onCreate && q.length > 0 && !exactMatch

  const handleSelect = (optValue: string) => {
    onChange(optValue)
    setOpen(false)
    setSearch('')
  }

  const handleCreate = () => {
    if (!onCreate) return
    onCreate(search.trim())
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={triggerAriaLabel}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            {filtered.length === 0 && !canCreate && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem key={opt.value} value={opt.value} onSelect={() => handleSelect(opt.value)}>
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value={`__create__${search}`} onSelect={handleCreate}>
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{createLabel(search.trim())}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
