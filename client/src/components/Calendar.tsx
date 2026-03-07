import { useState } from "react"
import { Calendar as UICalendar } from "#/components/ui/calendar"

/**
 * Standalone calendar component (single date).
 * For the date filter with range + presets, see the date Filter in Filter.tsx.
 */
export function Calendar() {
  const [date, setDate] = useState<Date | undefined>(undefined)
  return (
    <UICalendar
      mode="single"
      selected={date}
      onSelect={setDate}
      className="rounded-lg border"
    />
  )
}
