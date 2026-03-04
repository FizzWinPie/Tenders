import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { DateFilterState } from '#/types/search'

const COUNTRY_LABELS: Record<string, string> = {
  AUT: 'Österreich',
  BEL: 'Belgien',
  CHE: 'Schweiz',
  DEU: 'Deutschland',
  ESP: 'Spanien',
  FRA: 'Frankreich',
  HRV: 'Kroatien',
  ITA: 'Italien',
  NLD: 'Niederlande',
  POL: 'Polen',
}

const NOTICE_TYPE_LABELS: Record<string, string> = {
  'pin-cfc-social': 'PIN CFC Social',
  'pin-cfc-standard': 'PIN CFC Standard',
  'pin-only': 'PIN only',
  'pin-rtl': 'PIN RTL',
  'pin-tran': 'PIN Transport',
  pmc: 'PMC',
  'qu-sy': 'QU/SY',
  subco: 'Subco',
  veat: 'VEAT',
}

function formatToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export type DateFilterProps = {
  type: 'date'
  label: string
  value: DateFilterState
  onChange: (value: DateFilterState) => void
  onApply: () => void
}

export type MultiSelectFilterProps = {
  type: 'country' | 'language' | 'noticeType'
  label: string
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  onApply: () => void
}

export type FilterProps = DateFilterProps | MultiSelectFilterProps

function isDateFilter(p: FilterProps): p is DateFilterProps {
  return p.type === 'date'
}

export function Filter(props: FilterProps) {
  const displayLabel = props.label ?? props.type

  if (isDateFilter(props)) {
    const { value, onChange, onApply } = props
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={`Filter: ${displayLabel}`}>
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="grid gap-4">
            <h4 className="text-sm font-medium">{displayLabel}</h4>
            <div className="flex gap-2">
              <Label className="sr-only">Modus</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={value.date_mode}
                onChange={(e) =>
                  onChange({
                    ...value,
                    date_mode: e.target.value as 'exact' | 'range',
                  })
                }
              >
                <option value="exact">Einzelnes Datum</option>
                <option value="range">Zeitraum</option>
              </select>
            </div>
            {value.date_mode === 'exact' ? (
              <div className="grid gap-2">
                <Label htmlFor="filter-date-exact">Datum (YYYYMMDD)</Label>
                <Input
                  id="filter-date-exact"
                  placeholder={formatToday()}
                  value={value.input_date}
                  onChange={(e) =>
                    onChange({ ...value, input_date: e.target.value })
                  }
                  className="h-8"
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="filter-date-from">Von (YYYYMMDD)</Label>
                <Input
                  id="filter-date-from"
                  value={value.date_from}
                  onChange={(e) =>
                    onChange({ ...value, date_from: e.target.value })
                  }
                  className="h-8"
                />
                <Label htmlFor="filter-date-to">Bis (YYYYMMDD)</Label>
                <Input
                  id="filter-date-to"
                  value={value.date_to}
                  onChange={(e) =>
                    onChange({ ...value, date_to: e.target.value })
                  }
                  className="h-8"
                />
              </div>
            )}
            <Button type="button" size="sm" onClick={onApply}>
              Anwenden
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  const { type, options, value, onChange, onApply } = props
  const labelMap =
    type === 'country'
      ? COUNTRY_LABELS
      : type === 'noticeType'
        ? NOTICE_TYPE_LABELS
        : null
  const getLabel = (opt: string) => (labelMap ? labelMap[opt] ?? opt : opt)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Filter: ${displayLabel}`}>
          {displayLabel}
          {value.length > 0 && ` (${value.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-72 overflow-y-auto" align="start">
        <div className="grid gap-4">
          <h4 className="text-sm font-medium">{displayLabel}</h4>
          <div className="grid gap-2">
            {options.map((opt) => {
              const checked = value.includes(opt)
              const display = getLabel(opt)
              return (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) {
                        onChange(value.filter((x) => x !== opt))
                      } else {
                        onChange([...value, opt])
                      }
                    }}
                    className="h-4 w-4 rounded border-input"
                  />
                  {display}
                </label>
              )
            })}
          </div>
          <Button type="button" size="sm" onClick={onApply}>
            Anwenden
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
