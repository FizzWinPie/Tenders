import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export type FilterProps = {
  type: string
  label?: string
}

export function Filter({ type, label }: FilterProps) {
  const displayLabel = label ?? type
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-label={`Filter by ${displayLabel}`}>
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium leading-none">{displayLabel}</h4>
            <p className="text-sm text-muted-foreground">
              Configure {displayLabel.toLowerCase()} filter.
            </p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`filter-${type}`}>Value</Label>
              <Input
                id={`filter-${type}`}
                placeholder={`Select ${displayLabel.toLowerCase()}...`}
                className="col-span-2 h-8"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
