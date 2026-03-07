import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import type { DateFilterState } from '#/types/search'

function dateToYYYYMMDD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function yyyymmddToDate(s: string): Date | undefined {
  if (!s || s.length !== 8) return undefined
  const y = parseInt(s.slice(0, 4), 10)
  const m = parseInt(s.slice(4, 6), 10) - 1
  const d = parseInt(s.slice(6, 8), 10)
  const date = new Date(y, m, d)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getDefaultRangeWeek(): { date_from: string; date_to: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  return { date_from: dateToYYYYMMDD(start), date_to: dateToYYYYMMDD(end) }
}

const DATE_PRESETS: { id: string; label: string; getValue: () => DateFilterState }[] = [
  {
    id: 'today',
    label: 'Heute',
    getValue: () => {
      const d = new Date()
      return { date_mode: 'exact', input_date: dateToYYYYMMDD(d), date_from: '', date_to: '' }
    },
  },
  {
    id: 'last7',
    label: 'Letzte 7 Tage',
    getValue: () => {
      const def = getDefaultRangeWeek()
      return { date_mode: 'range', input_date: '', date_from: def.date_from, date_to: def.date_to }
    },
  },
  {
    id: 'last30',
    label: 'Letzte 30 Tage',
    getValue: () => {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      return {
        date_mode: 'range',
        input_date: '',
        date_from: dateToYYYYMMDD(start),
        date_to: dateToYYYYMMDD(end),
      }
    },
  },
]

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

const LANGUAGE_LABELS: Record<string, string> = {
  DEU: 'Deutsch',
  ENG: 'Englisch',
  FRA: 'Französisch',
  ITA: 'Italienisch',
  SPA: 'Spanisch',
  NLD: 'Niederländisch',
  POL: 'Polnisch',
  ELL: 'Griechisch',
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
    const handleModeChange = (mode: 'exact' | 'range') => {
      if (mode === value.date_mode) return
      if (mode === 'range') {
        const def = getDefaultRangeWeek()
        onChange({ ...value, date_mode: 'range', input_date: '', date_from: def.date_from, date_to: def.date_to })
      } else {
        const d = new Date()
        onChange({ ...value, date_mode: 'exact', input_date: dateToYYYYMMDD(d), date_from: '', date_to: '' })
      }
    }
    const singleDate = value.date_mode === 'exact' ? yyyymmddToDate(value.input_date) : undefined
    const rangeFrom = value.date_mode === 'range' ? yyyymmddToDate(value.date_from) : undefined
    const rangeTo = value.date_mode === 'range' ? yyyymmddToDate(value.date_to) : undefined
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`Filter: ${displayLabel}`}
            className="data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
          >
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="grid gap-3 p-3">
            {/* <h4 className="text-sm font-medium px-2">{displayLabel}</h4> */}
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    onChange(preset.getValue())
                    onApply()
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Label className="sr-only">Modus</Label>
              <select
                className="h-9 text-center rounded-md border border-input bg-background px-3 text-sm w-full"
                value={value.date_mode}
                onChange={(e) => handleModeChange(e.target.value as 'exact' | 'range')}
              >
                <option value="exact">Einzelnes Datum</option>
                <option value="range">Zeitraum</option>
              </select>
            </div>
            {value.date_mode === 'exact' ? (
              <Calendar
                mode="single"
                selected={singleDate}
                onSelect={(d) =>
                  onChange({
                    ...value,
                    date_mode: 'exact',
                    input_date: d ? dateToYYYYMMDD(d) : '',
                    date_from: '',
                    date_to: '',
                  })
                }
                className="rounded-lg border"
              />
            ) : (
              <Calendar
                mode="range"
                selected={
                  rangeFrom || rangeTo
                    ? { from: rangeFrom ?? undefined, to: rangeTo ?? rangeFrom ?? undefined }
                    : undefined
                }
                onSelect={(range) => {
                  if (range?.from) {
                    onChange({
                      ...value,
                      date_mode: 'range',
                      input_date: '',
                      date_from: dateToYYYYMMDD(range.from),
                      date_to: range.to ? dateToYYYYMMDD(range.to) : dateToYYYYMMDD(range.from),
                    })
                  }
                }}
                className="rounded-lg border"
              />
            )}
            <Button type="button" size="sm" onClick={onApply} className="w-full">
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
      : type === 'language'
        ? LANGUAGE_LABELS
        : null
  const getLabel = (opt: string) => (labelMap ? labelMap[opt] ?? opt : opt)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Filter: ${displayLabel}`}
          className="data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
        >
          {displayLabel}
          {value.length > 0 && ` (${value.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full overflow-y-auto" align="start">
        <div className="grid gap-4">
          {/* <h4 className="text-sm font-medium">{displayLabel}</h4> */}
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
